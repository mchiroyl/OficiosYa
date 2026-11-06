import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { createResourceController } from './resource.controller';
import { ResourceService } from './resource.service';
import { RESOURCES } from './resources.config';

@Module({
  imports: [AuthModule],
  controllers: RESOURCES.map((resource) => createResourceController(resource)),
  providers: [ResourceService],
})
export class ResourcesModule {}
