/**
 * Mock data local para el perfil público del trabajador (HU-08 / HU-06 / HU-12).
 * Separado de la UI a propósito; reemplazable por API real más adelante.
 */

export const workers = [
  {
    id: '1',
    name: 'Carlos Ramírez',
    profession: 'Electricista',
    rating: 4.9,
    reviewCount: 48,
    location: 'Monterrey, Nuevo León',
    shortBio:
      'Especialista en instalaciones eléctricas, mantenimiento residencial y reparación de fallas.',
    about:
      'Más de 8 años ofreciendo servicios eléctricos residenciales y comerciales en la zona metropolitana de Monterrey. Me enfoco en diagnósticos claros, trabajo limpio y comunicación constante con el cliente.',
    experienceYears: 8,
    availability: 'Disponible esta semana',
    available: true,
    services: [
      'Instalaciones eléctricas',
      'Reparaciones',
      'Mantenimiento',
      'Diagnóstico de fallas',
    ],
    avatar:
      'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=320&h=320&q=80',
    gallery: [
      {
        id: 'g1',
        src: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=900&h=600&q=80',
        alt: 'Instalación eléctrica residencial terminada',
      },
      {
        id: 'g2',
        src: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&h=600&q=80',
        alt: 'Tablero eléctrico organizado tras mantenimiento',
      },
      {
        id: 'g3',
        src: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=900&h=600&q=80',
        alt: 'Reparación de cableado en área de trabajo',
      },
      {
        id: 'g4',
        src: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=900&h=600&q=80',
        alt: 'Herramientas y materiales usados en el servicio',
      },
    ],
    coverage: {
      centerLabel: 'Monterrey, N.L.',
      radiusKm: 15,
      description: 'Zona de cobertura: hasta 15 km alrededor de Monterrey, N.L.',
      // Coordenadas mock listas para un proveedor de mapas real (Leaflet/Mapbox).
      center: { lat: 25.6866, lng: -100.3161 },
      areas: ['Monterrey', 'San Pedro', 'San Nicolás', 'Guadalupe', 'Apodaca'],
    },
  },
];

export function getWorkerById(id) {
  return workers.find((worker) => worker.id === id) ?? null;
}

export const DEFAULT_WORKER_ID = workers[0].id;
