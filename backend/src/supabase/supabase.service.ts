import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  readonly admin: SupabaseClient;
  readonly anon: SupabaseClient;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('SUPABASE_URL');
    const publishableKey = config.getOrThrow<string>('SUPABASE_PUBLISHABLE_KEY');
    const secretKey = config.getOrThrow<string>('SUPABASE_SECRET_KEY');

    this.admin = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    this.anon = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  from(table: string) {
    return this.admin.from(table);
  }
}
