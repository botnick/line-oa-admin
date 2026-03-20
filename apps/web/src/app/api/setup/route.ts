import { NextRequest, NextResponse } from 'next/server';
import { saveSettings, isSetupCompleted, dayjs } from '@line-oa/config/settings';

/**
 * POST /api/setup
 *
 * First-run setup wizard endpoint.
 * Saves LINE Channel, LINE Login, and R2 Storage configs to JSON file.
 * Hot-reloadable — no service restart needed.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    saveSettings({
      setup: {
        completed: true,
        completedAt: dayjs().toISOString(),
      },
      app: {
        baseUrl: body.appBaseUrl ?? '',
        appName: body.appName ?? 'LINE OA Admin',
      },
      lineLogin: {
        channelId: body.lineLoginChannelId ?? '',
        channelSecret: body.lineLoginChannelSecret ?? '',
      },
      r2: {
        accountId: body.r2AccountId ?? '',
        accessKeyId: body.r2AccessKeyId ?? '',
        secretAccessKey: body.r2SecretAccessKey ?? '',
        bucketName: body.r2BucketName ?? 'line-oa-media',
        endpoint: body.r2Endpoint ?? '',
        publicUrl: body.r2PublicUrl ?? '',
      },
    });

    const response = NextResponse.json({ success: true });

    // Set cookie so Edge Runtime middleware knows setup is done
    response.cookies.set('setup_completed', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365 * 10, // 10 years
    });

    return response;
  } catch (error) {
    console.error('[setup] Failed to save settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save settings' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/setup
 *
 * Returns whether setup has been completed.
 * Also syncs the cookie if JSON says done but cookie is missing.
 */
export async function GET(request: NextRequest) {
  try {
    const completed = isSetupCompleted();
    const response = NextResponse.json({ completed });

    // Sync cookie: if JSON says done but cookie is missing, set it
    if (completed && request.cookies.get('setup_completed')?.value !== 'true') {
      response.cookies.set('setup_completed', 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365 * 10,
      });
    }

    return response;
  } catch {
    return NextResponse.json({ completed: false });
  }
}
