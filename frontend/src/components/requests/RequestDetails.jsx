import Rating from '../worker/Rating';
import styles from '../../pages/Dashboard.module.css';

export default function RequestDetails({ request, perspective }) {
  const person = perspective === 'worker' ? request.cliente : request.trabajador;
  return (
    <div className={styles.details}>
      {person && <p><strong>{perspective === 'worker' ? 'Cliente' : 'Profesional'}:</strong> {person.nombre || person.oficio_principal}</p>}
      {request.servicio && <p><strong>Servicio:</strong> {request.servicio.nombre}</p>}
      {request.ubicacion_aprox && <p><strong>Ubicación:</strong> {request.ubicacion_aprox}</p>}
      {request.resena && (
        <div className={styles.review}>
          <Rating value={request.resena.calificacion} />
          {request.resena.comentario && <p>{request.resena.comentario}</p>}
        </div>
      )}
    </div>
  );
}
