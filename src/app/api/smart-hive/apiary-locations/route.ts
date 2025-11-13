// app/api/smart-hive/apiary-locations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET - Fetch all apiary locations
export async function GET(request: NextRequest) {
  try {
    // Fetch all locations from database
    const locations = await prisma.apiaryLocation.findMany({
      orderBy: {
        updatedAt: 'desc'
      }
    });

    // Convert array to object keyed by containerId for easier lookup
    const locationsMap: Record<string, any> = {};
    locations.forEach((location) => {
      locationsMap[location.containerId] = {
        containerId: location.containerId,
        lat: location.latitude,
        lon: location.longitude,
        address: location.address,
        updatedAt: location.updatedAt
      };
    });

    return NextResponse.json({
      success: true,
      data: locationsMap
    });
  } catch (error: any) {
    console.error('❌ Error fetching apiary locations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}

// POST - Save or update apiary location
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { containerId, lat, lon, address } = body;

    console.log('📥 Received location data:', { containerId, lat, lon, address });

    // Validate required fields
    if (!containerId || lat == null || lon == null) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: containerId, lat, lon' },
        { status: 400 }
      );
    }

    // Validate coordinate ranges
    if (lat < -90 || lat > 90) {
      return NextResponse.json(
        { success: false, error: 'Latitude must be between -90 and 90' },
        { status: 400 }
      );
    }

    if (lon < -180 || lon > 180) {
      return NextResponse.json(
        { success: false, error: 'Longitude must be between -180 and 180' },
        { status: 400 }
      );
    }

    // Upsert the location (insert or update if exists)
    const location = await prisma.apiaryLocation.upsert({
      where: {
        containerId: containerId
      },
      update: {
        latitude: lat,
        longitude: lon,
        address: address || null,
        updatedAt: new Date()
      },
      create: {
        containerId: containerId,
        latitude: lat,
        longitude: lon,
        address: address || null
      }
    });

    console.log('✅ Location saved:', location);

    return NextResponse.json({
      success: true,
      message: 'Location saved successfully',
      data: {
        containerId: location.containerId,
        lat: location.latitude,
        lon: location.longitude,
        address: location.address
      }
    });
  } catch (error: any) {
    console.error('❌ Error saving apiary location:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save location: ' + error.message },
      { status: 500 }
    );
  }
}

// DELETE - Remove apiary location
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const containerId = searchParams.get('containerId');

    if (!containerId) {
      return NextResponse.json(
        { success: false, error: 'Container ID is required' },
        { status: 400 }
      );
    }

    await prisma.apiaryLocation.delete({
      where: {
        containerId: containerId
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Location deleted successfully'
    });
  } catch (error: any) {
    console.error('❌ Error deleting apiary location:', error);
    
    // Handle case where location doesn't exist
    if (error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Location not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to delete location' },
      { status: 500 }
    );
  }
}