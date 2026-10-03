import { Injectable } from '@nestjs/common';
import { ChatMessage } from './chat.types';

type Waiter = {
  afterId: number;
  resolve: (messages: ChatMessage[]) => void;
  timer: NodeJS.Timeout;
};

type PublishListener = (idSolicitud: number, message: ChatMessage) => void;

@Injectable()
export class ChatHub {
  private readonly waiters = new Map<number, Waiter[]>();
  private readonly listeners = new Set<PublishListener>();

  onPublish(listener: PublishListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(idSolicitud: number, message: ChatMessage) {
    for (const listener of this.listeners) {
      listener(idSolicitud, message);
    }

    const pending = this.waiters.get(idSolicitud) || [];
    if (!pending.length) return;

    const ready = pending.filter((waiter) => message.id_mensaje > waiter.afterId);
    const rest = pending.filter((waiter) => message.id_mensaje <= waiter.afterId);
    if (rest.length) {
      this.waiters.set(idSolicitud, rest);
    } else {
      this.waiters.delete(idSolicitud);
    }

    for (const waiter of ready) {
      clearTimeout(waiter.timer);
      waiter.resolve([message]);
    }
  }

  waitFor(idSolicitud: number, afterId: number, timeoutMs: number): Promise<ChatMessage[]> {
    return new Promise((resolve) => {
      const waiter: Waiter = {
        afterId,
        resolve,
        timer: setTimeout(() => {
          this.removeWaiter(idSolicitud, waiter);
          resolve([]);
        }, timeoutMs),
      };

      const list = this.waiters.get(idSolicitud) || [];
      list.push(waiter);
      this.waiters.set(idSolicitud, list);
    });
  }

  private removeWaiter(idSolicitud: number, waiter: Waiter) {
    const list = this.waiters.get(idSolicitud) || [];
    const next = list.filter((item) => item !== waiter);
    if (next.length) {
      this.waiters.set(idSolicitud, next);
    } else {
      this.waiters.delete(idSolicitud);
    }
  }
}
