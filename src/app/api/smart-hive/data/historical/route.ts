// app/api/smart-hive/data/historical/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { AzureBlobService } from '../../../../../lib/azure';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { fetchCalibrations, applyCalibrationToDataset } from '../../../../../lib/calibrationUtils';

const prisma     = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const LOG_LEVEL  = process.env.LOG_LEVEL || 'production';
const isVerbose  = LOG_LEVEL === 'verbose' || LOG_LEVEL === 'debug';

export async function GET(request: NextRequest) {
  console.log('🚀 [HISTORICAL API] Starting request');

  try {
    const searchParams = request.nextUrl.searchParams;
    const limit        = parseInt(searchParams.get('limit')    || '200');
    const dateFrom     = searchParams.get('dateFrom');
    const dateTo       = searchParams.get('dateTo');
    const containerId  = searchParams.get('containerId');

    if (isVerbose) console.log('📊 Request params:', { limit, dateFrom, dateTo, containerId });

    if (!containerId) {
      return NextResponse.json(
        { error: 'containerId parameter is required', data: [], timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    // ── Auth ────────────────────────────────────────────────────────────────
    const token =
      request.cookies.get('user-token')?.value ||
      request.cookies.get('auth-token')?.value;

    let userId: number | null = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        userId = decoded.userId || decoded.id;
        console.log('🔐 User authenticated:', userId);
      } catch {
        console.warn('⚠️ Invalid token for calibration lookup');
      }
    }

    // ── Read aggregated.json ─────────────────────────────────────────────────
    const azureService = new AzureBlobService(containerId);

    let aggregated: any;
    try {
      const raw  = await azureService.downloadBlob('aggregated.json');
      aggregated = JSON.parse(raw);
      console.log(`✅ Loaded aggregated.json — ${aggregated.historical?.length ?? 0} historical records`);
    } catch (err) {
      console.error('❌ Could not load aggregated.json:', err instanceof Error ? err.message : err);
      return NextResponse.json({
        error:     'aggregated.json not found. Trigger /api/smart-hive/aggregate first.',
        data:      [],
        containerId,
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    let historicalData: any[] = aggregated.historical ?? [];

    console.log(`📦 Total historical records before filtering: ${historicalData.length}`);

    // ── Date range filter ────────────────────────────────────────────────────
    if (dateFrom || dateTo) {
      const before = historicalData.length;
      historicalData = historicalData.filter((item: any) => {
        const d    = new Date(item.timestamp ?? item._metadata?.lastModified ?? 0);
        const from = dateFrom ? new Date(dateFrom) : null;
        const to   = dateTo   ? new Date(dateTo)   : null;
        return (!from || d >= from) && (!to || d <= to);
      });
      console.log(`📅 Date filtered: ${before} → ${historicalData.length} records`);
    }

    // ── Limit — take the most recent N records ───────────────────────────────
    if (historicalData.length > limit) {
      historicalData = historicalData.slice(-limit);
      console.log(`✂️  Limited to last ${limit} records`);
    }

    // ── Calibration ──────────────────────────────────────────────────────────
    if (userId && containerId) {
      try {
        const calibrations = await fetchCalibrations(userId, containerId, prisma);
        if (calibrations.size > 0) {
          console.log(`🔧 Applying ${calibrations.size} calibration(s) to historical data`);
          historicalData = applyCalibrationToDataset(historicalData, calibrations);
        } else {
          console.log('ℹ️ No calibrations found for this user/container');
        }
      } catch (calErr) {
        console.warn('⚠️ Calibration lookup failed, returning uncalibrated data:', calErr);
      }
    }

    // ── Sort newest first ────────────────────────────────────────────────────
    historicalData.sort((a: any, b: any) => {
      const tA = new Date(a.timestamp ?? a._metadata?.lastModified ?? 0).getTime();
      const tB = new Date(b.timestamp ?? b._metadata?.lastModified ?? 0).getTime();
      return tB - tA;
    });

    const isCalibrated = historicalData.some((r: any) => r._calibrated);

    if (isVerbose && historicalData[0]) {
      console.log('Sample record:', JSON.stringify(historicalData[0]).slice(0, 200));
    }

    console.log(
      `✅ Returning ${historicalData.length} historical records ` +
      `(Calibrated: ${isCalibrated})`
    );

    return NextResponse.json({
      data:         historicalData,
      containerId,
      totalRecords: historicalData.length,
      calibrated:   isCalibrated,
      timestamp:    new Date().toISOString(),
      metadata: {
        generatedAt:      aggregated.generatedAt,
        lastProcessedBlob: aggregated.lastProcessedBlob,
        requestedLimit:   limit,
        actualRecords:    historicalData.length,
        dateRange:        { from: dateFrom, to: dateTo },
        calibrated:       isCalibrated,
      },
    });

  } catch (error) {
    console.error('💥 Critical error:', error instanceof Error ? error.message : error);
    if (isVerbose && error instanceof Error) console.error('Stack:', error.stack);
    return NextResponse.json(
      { error: 'Failed to fetch historical data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const revalidate = 0;