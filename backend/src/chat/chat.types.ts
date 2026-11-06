export type ChatMessage = {
  id_mensaje: number;
  id_solicitud: number;
  id_emisor: number;
  emisor_nombre: string;
  contenido: string;
  adjunto_url: string | null;
  adjunto_thumb_url: string | null;
  tipo: 'texto' | 'imagen';
  fecha_envio: string;
  mio?: boolean;
};

export type ChatConversation = {
  id_solicitud: number;
  estado: string;
  descripcion: string;
  rol: 'cliente' | 'trabajador';
  contraparte: {
    id_usuario: number;
    nombre: string;
  };
  ultimo_mensaje: ChatMessage | null;
};
