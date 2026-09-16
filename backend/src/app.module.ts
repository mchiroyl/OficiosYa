import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ResourcesModule } from './resources/resources.module';
import { SupabaseModule } from './supabase/supabase.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { RequestsModule } from './requests/requests.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SearchModule } from './search/search.module';
import { WorkerModule } from './worker/worker.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    AuthModule,
    ResourcesModule,
    WorkerModule,
    PortfolioModule,
    SearchModule,
    RequestsModule,
    ReviewsModule,
  ],
})
export class AppModule {}
