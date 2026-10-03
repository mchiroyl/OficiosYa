import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsuarioRow } from '../common/usuario.util';
import { ChatService } from './chat.service';
import { ChatMessageResponseDto } from './dto/chat-message-response.dto';
import { ListMessagesDto, PollMessagesDto } from './dto/list-messages.dto';
import { SendTextDto } from './dto/send-text.dto';

@ApiTags('Chat')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  @ApiOperation({
    summary: 'Listar conversaciones del usuario (HU-16)',
    description: 'Solicitudes donde el usuario es cliente o trabajador, con el último mensaje.',
  })
  listConversations(@CurrentUser() user: UsuarioRow) {
    return this.chat.listConversations(user);
  }

  @Get('threads/:idSolicitud/messages')
  @ApiOperation({ summary: 'Historial de mensajes de una solicitud' })
  @ApiOkResponse({ type: [ChatMessageResponseDto] })
  listMessages(
    @CurrentUser() user: UsuarioRow,
    @Param('idSolicitud', ParseIntPipe) idSolicitud: number,
    @Query() query: ListMessagesDto,
  ) {
    return this.chat.listMessages(user, idSolicitud, query);
  }

  @Get('threads/:idSolicitud/poll')
  @ApiOperation({
    summary: 'Long-polling de mensajes nuevos (respaldo de HU-16)',
    description:
      'Si no hay mensajes posteriores a `after`, espera hasta `timeout` segundos. Úsalo si el WebSocket no está disponible.',
  })
  pollMessages(
    @CurrentUser() user: UsuarioRow,
    @Param('idSolicitud', ParseIntPipe) idSolicitud: number,
    @Query() query: PollMessagesDto,
  ) {
    return this.chat.pollMessages(user, idSolicitud, query);
  }

  @Post('threads/:idSolicitud/messages')
  @ApiOperation({
    summary: 'Enviar un mensaje de texto',
    description:
      'Persiste en `mensaje` y notifica en tiempo real por WebSocket (sala solicitud:{id}) y a quienes esperan en long-polling.',
  })
  @ApiOkResponse({ type: ChatMessageResponseDto })
  sendText(
    @CurrentUser() user: UsuarioRow,
    @Param('idSolicitud', ParseIntPipe) idSolicitud: number,
    @Body() dto: SendTextDto,
  ) {
    return this.chat.sendText(user, idSolicitud, dto.contenido);
  }

  @Post('threads/:idSolicitud/images')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Enviar una imagen en el chat',
    description: 'Comprime con sharp, sube a Supabase Storage y guarda la URL en mensaje.adjunto_url.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        contenido: { type: 'string', description: 'Pie de foto opcional' },
      },
    },
  })
  @ApiOkResponse({ type: ChatMessageResponseDto })
  sendImage(
    @CurrentUser() user: UsuarioRow,
    @Param('idSolicitud', ParseIntPipe) idSolicitud: number,
    @UploadedFile()
    file: { buffer: Buffer; mimetype?: string; originalname?: string },
    @Body('contenido') contenido?: string,
  ) {
    return this.chat.sendImage(user, idSolicitud, file, contenido);
  }
}
