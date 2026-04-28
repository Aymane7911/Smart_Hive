// app/api/smart-hive/data/latest/route.ts
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
  console.log('🚀 [LATEST API] Starting request');

  try {
    const searchParams = request.nextUrl.searchParams;
    const containerId  = searchParams.get('containerId');

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
      console.log(`✅ Loaded aggregated.json — ${aggregated.latest?.length ?? 0} latest, ${aggregated.historical?.length ?? 0} historical`);
    } catch (err) {
      console.error('❌ Could not load aggregated.json:', err instanceof Error ? err.message : err);
      return NextResponse.json({
        error:     'aggregated.json not found. Trigger /api/smart-hive/aggregate first.',
        data:      [],
        containerId,
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    let latestData:     any[] = aggregated.latest     ?? [];
    let historicalData: any[] = aggregated.historical ?? [];

    // ── Diagnostic ───────────────────────────────────────────────────────────
    const sampleIds = new Set<any>();
    latestData.forEach((item: any) => {
      const id = item.id ?? item.ID ?? item.hive_id ?? item.hiveId;
      if (id != null && !sampleIds.has(id)) {
        sampleIds.add(id);
        console.log(`🔍 [LATEST RAW] id=${id} timestamp=${item.timestamp} keys=${Object.keys(item).join(',')}`);
      }
    });

    console.log(`📊 Historical records before cutoff filter: ${historicalData.length}`);

    // ── Manahel cutoff — only show from Apr 24 12:00 Dubai (08:00 UTC) ──────
    if (containerId === 'h-manahel') {
      const CUTOFF = new Date('2026-04-24T08:00:00Z').getTime();
      historicalData = historicalData.filter((item: any) => {
        // Prioritize timestamp field over time field
        const ts = item.timestamp ?? item._metadata?.lastModified ?? item.time ?? null;
        if (!ts) return false;
        return new Date(ts).getTime() >= CUTOFF;
      });
      console.log(`📊 Historical records after cutoff filter: ${historicalData.length}`);
    }

    if (isVerbose) {
      console.log(`📊 Latest: ${latestData.length}, Historical: ${historicalData.length}`);
      if (latestData[0])     console.log('Sample latest:',     JSON.stringify(latestData[0]).slice(0, 200));
      if (historicalData[0]) console.log('Sample historical:', JSON.stringify(historicalData[0]).slice(0, 200));
    }

    // ── Calibration ──────────────────────────────────────────────────────────
    if (userId && containerId) {
      try {
        const calibrations = await fetchCalibrations(userId, containerId, prisma);
        if (calibrations.size > 0) {
          console.log(`🔧 Applying ${calibrations.size} calibration(s)`);
          latestData     = applyCalibrationToDataset(latestData,     calibrations);
          historicalData = applyCalibrationToDataset(historicalData, calibrations);
        } else {
          console.log('ℹ️ No calibrations found');
        }
      } catch (calErr) {
        console.warn('⚠️ Calibration lookup failed, returning uncalibrated data:', calErr);
      }
    }

    const isCalibrated = latestData.some((r: any) => r._calibrated);

    console.log(`✅ Returning ${latestData.length} latest, ${historicalData.length} historical (Calibrated: ${isCalibrated})`);

    return NextResponse.json({
      data: [{
        blobInfo: {
          name:         'aggregated.json',
          lastModified:  aggregated.generatedAt,
          containerId,
          format:       'aggregated',
        },
        csvMetadata: {
          normalized:     true,
          detectedFormat: 'aggregated',
          calibrated:     isCalibrated,
        },
        data:        latestData,
        historical:  historicalData,  // ← historical now included
        recordCount: latestData.length,
      }],
      containerId,
      totalBlobs: 1,
      timestamp:  new Date().toISOString(),
      summary: {
        totalRecords:      latestData.length,
        totalHistorical:   historicalData.length,
        generatedAt:       aggregated.generatedAt,
        lastProcessedBlob: aggregated.lastProcessedBlob,
        calibrated:        isCalibrated,
      },
    });

  } catch (error) {
    console.error('💥 Critical error:', error instanceof Error ? error.message : error);
    if (isVerbose && error instanceof Error) console.error('Stack:', error.stack);
    return NextResponse.json(
      { error: 'Failed to fetch latest data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const revalidate = 0;