import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ImageCompressService } from './image-compress.service';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { StorageService } from './storage.service';

@Module({
  imports: [AuthModule],
  controllers: [PortfolioController],
  providers: [PortfolioService, ImageCompressService, StorageService],
})
export class PortfolioModule {}
