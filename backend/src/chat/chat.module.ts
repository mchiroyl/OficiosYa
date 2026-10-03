import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatHub } from './chat.hub';
import { ChatService } from './chat.service';

@Module({
  imports: [AuthModule, PortfolioModule],
  controllers: [ChatController],
  providers: [ChatService, ChatHub, ChatGateway],
})
export class ChatModule {}
