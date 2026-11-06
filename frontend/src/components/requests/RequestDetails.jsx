import Rating from '../worker/Rating';
import styles from '../../pages/Dashboard.module.css';

export default function RequestDetails({ request, perspective }) {
  const person = perspective === 'worker' ? request.cliente : request.trabajador;
  const imagePattern = /Imagen de referencia \d+: (https?:\/\/\S+)/g;
  const images = [...String(request.descripcion || '').matchAll(imagePattern)].map((match) => match[1]);
  const description = String(request.descripcion || '').replace(imagePattern, '').trim();
  return (
    <div className={styles.details}>
      {person && <p><strong>{perspective === 'worker' ? 'Cliente' : 'Profesional'}:</strong> {person.nombre || person.oficio_principal}</p>}
      {request.servicio && <p><strong>Servicio:</strong> {request.servicio.nombre}</p>}
      {request.ubicacion_aprox && <p><strong>Ubicación:</strong> {request.ubicacion_aprox}</p>}
      {description && <p><strong>Descripción:</strong> {description}</p>}
      {images.length > 0 && <div><strong>Imágenes de referencia:</strong><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        {images.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Referencia ${index + 1}`} loading="lazy" style={{ width: 92, height: 72, objectFit: 'cover', borderRadius: 8 }} /></a>)}
      </div></div>}
      {request.resena && (
        <div className={styles.review}>
          <Rating value={request.resena.calificacion} />
          {request.resena.comentario && <p>{request.resena.comentario}</p>}
        </div>
      )}
    </div>
  );
}
