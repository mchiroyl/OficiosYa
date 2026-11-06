import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [AuthModule, PortfolioModule],
  controllers: [IdentityController, ReportsController],
  providers: [IdentityService, ReportsService],
})
export class ModerationModule {}
