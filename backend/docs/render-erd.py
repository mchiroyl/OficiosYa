from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent
STEM = "01_Diagrama_Entidad_Relacion_ERD_Conceptual_y_Fisico"
W, H = 3300, 4200
BG = (243, 238, 228)
INK = (31, 58, 68)
MUTED = (71, 85, 105)
CARD = (255, 253, 248)
HEADER = (31, 58, 68)
LINE = (91, 107, 115)
PK = (180, 83, 9)
FK = (15, 118, 110)
UQ = (29, 78, 216)
WHITE = (248, 250, 252)
NOTE = (232, 240, 242)


def font(size, bold=False):
    name = "arialbd.ttf" if bold else "arial.ttf"
    for folder in (Path("C:/Windows/Fonts"), Path("/usr/share/fonts/truetype/msttcorefonts")):
        candidate = folder / name
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


F14 = font(14)
F15 = font(15)
F16 = font(16)
F16B = font(16, True)
F18B = font(18, True)
F22B = font(22, True)
F28B = font(28, True)
F36B = font(36, True)


def text(draw, xy, value, fnt=F14, fill=INK, anchor="lt"):
    draw.text(xy, value, font=fnt, fill=fill, anchor=anchor)


def rounded(draw, box, radius, fill, outline=INK, width=2):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def entity(draw, x, y, name, w=250, h=58):
    rounded(draw, (x, y, x + w, y + h), 10, (244, 239, 228), INK, 2)
    text(draw, (x + w / 2, y + h / 2), name, F16B, INK, "mm")
    return x, y, w, h, x + w / 2, y + h / 2


def connect(draw, a, b, label, card):
    x1, y1 = a[4], a[5]
    x2, y2 = b[4], b[5]
    draw.line((x1, y1, x2, y2), fill=LINE, width=2)
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    text(draw, (mx, my - 8), f"{label} ({card})", F14, MUTED, "mm")


def table(draw, x, y, name, columns, width=490):
    row_h = 26
    header_h = 40
    height = header_h + 8 + len(columns) * row_h
    rounded(draw, (x, y, x + width, y + height), 8, CARD, INK, 2)
    draw.rectangle((x, y, x + width, y + header_h), fill=HEADER)
    text(draw, (x + 14, y + 20), name, F16B, WHITE, "lm")
    for i, col in enumerate(columns):
        yy = y + header_h + 18 + i * row_h
        mark, color = "", MUTED
        if col.get("pk"):
            mark, color = "PK", PK
        elif col.get("fk"):
            mark, color = "FK", FK
        if col.get("uq"):
            mark = f"{mark}+UQ" if mark else "UQ"
            if not col.get("pk") and not col.get("fk"):
                color = UQ
        if mark:
            text(draw, (x + 12, yy), mark, F14, color, "lm")
        text(draw, (x + 70, yy), col["name"], F15, INK, "lm")
        text(draw, (x + width - 12, yy), col["type"], F14, MUTED, "rm")
    return height


def main():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    d.rectangle((0, 0, W, 120), fill=HEADER)
    text(d, (70, 38), "OficiosYa  -  Diagrama Entidad-Relacion", F36B, WHITE, "lt")
    text(d, (70, 86), "01  ERD conceptual y fisico   |   PostgreSQL / Supabase   |   Modelo inicial", F18B, (215, 227, 231), "lt")
    text(d, (W - 70, 60), "Documentacion tecnica", F16, (215, 227, 231), "rm")

    rounded(d, (50, 150, W - 50, 980), 16, (255, 250, 242), INK, 2)
    text(d, (80, 178), "A. Modelo conceptual", F28B, INK, "lt")
    text(d, (80, 220), "Entidades del negocio y cardinalidades. No incluye tipos de dato ni constraints.", F15, MUTED, "lt")

    usuario = entity(d, 120, 320, "USUARIO")
    perfil = entity(d, 520, 250, "PERFIL_TRABAJADOR", 280)
    portafolio = entity(d, 980, 250, "PORTAFOLIO")
    zona = entity(d, 120, 500, "ZONA")
    perfil_zona = entity(d, 520, 420, "PERFIL_ZONA")
    servicio = entity(d, 980, 420, "SERVICIO_OFRECIDO", 270)
    categoria = entity(d, 1400, 420, "CATEGORIA")
    solicitud = entity(d, 520, 620, "SOLICITUD_SERVICIO", 280)
    cotizacion = entity(d, 120, 780, "COTIZACION_PRIVADA", 280)
    mensaje = entity(d, 520, 820, "MENSAJE")
    resena = entity(d, 980, 720, "RESENA")
    reporte = entity(d, 1400, 620, "REPORTE")
    bitacora = entity(d, 1400, 820, "BITACORA")

    connect(d, usuario, perfil, "tiene", "1:1")
    connect(d, perfil, portafolio, "publica", "1:N")
    connect(d, perfil, perfil_zona, "cubre", "1:N")
    connect(d, zona, perfil_zona, "asocia", "1:N")
    connect(d, perfil, servicio, "ofrece", "1:N")
    connect(d, categoria, servicio, "clasifica", "1:N")
    connect(d, usuario, solicitud, "solicita", "1:N")
    connect(d, perfil, solicitud, "atiende", "1:N")
    connect(d, servicio, solicitud, "detalle", "1:N")
    connect(d, solicitud, cotizacion, "cotiza", "1:1")
    connect(d, solicitud, mensaje, "conversa", "1:N")
    connect(d, solicitud, resena, "califica", "1:1")
    connect(d, usuario, reporte, "reporta", "1:N")
    connect(d, usuario, bitacora, "registra", "1:N")

    rounded(d, (50, 1010, W - 50, 3520), 16, (255, 250, 242), INK, 2)
    text(d, (80, 1040), "B. Modelo fisico", F28B, INK, "lt")
    text(d, (400, 1044), "Tablas, campos, tipos, PK / FK / UNIQUE e identity. Esquema public.", F15, MUTED, "lt")

    tables = [
        (80, 1090, "usuario", [
            {"name": "id_usuario", "type": "integer identity", "pk": True},
            {"name": "nombre", "type": "varchar(150)"},
            {"name": "correo", "type": "varchar(150)", "uq": True},
            {"name": "telefono", "type": "varchar(20)"},
            {"name": "password_hash", "type": "varchar(255)"},
            {"name": "modo_activo", "type": "boolean"},
            {"name": "estado", "type": "varchar(30)"},
        ]),
        (600, 1090, "perfil_trabajador", [
            {"name": "id_perfil", "type": "integer identity", "pk": True},
            {"name": "id_usuario", "type": "integer", "fk": True, "uq": True},
            {"name": "oficio_principal", "type": "varchar(150)"},
            {"name": "descripcion", "type": "text / JSON"},
            {"name": "experiencia", "type": "varchar(100)"},
            {"name": "disponibilidad", "type": "varchar(100)"},
            {"name": "contacto_visible", "type": "boolean"},
            {"name": "verificado", "type": "boolean"},
            {"name": "reputacion_promedio", "type": "numeric(3,2)"},
            {"name": "total_resenas", "type": "integer"},
        ]),
        (1120, 1090, "zona", [
            {"name": "id_zona", "type": "integer identity", "pk": True},
            {"name": "nombre", "type": "varchar(100)", "uq": True},
            {"name": "tipo", "type": "varchar(50)"},
            {"name": "estado", "type": "varchar(30)"},
        ]),
        (1640, 1090, "perfil_zona", [
            {"name": "id_perfil", "type": "integer", "pk": True, "fk": True},
            {"name": "id_zona", "type": "integer", "pk": True, "fk": True},
        ]),
        (2160, 1090, "categoria", [
            {"name": "id_categoria", "type": "integer identity", "pk": True},
            {"name": "nombre", "type": "varchar(100)", "uq": True},
            {"name": "estado", "type": "varchar(30)"},
        ]),
        (2680, 1090, "servicio_ofrecido", [
            {"name": "id_servicio", "type": "integer identity", "pk": True},
            {"name": "id_perfil", "type": "integer", "fk": True},
            {"name": "id_categoria", "type": "integer", "fk": True},
            {"name": "nombre", "type": "varchar(150)"},
            {"name": "descripcion", "type": "text"},
            {"name": "activo", "type": "boolean"},
        ]),
        (80, 1560, "solicitud_servicio", [
            {"name": "id_solicitud", "type": "integer identity", "pk": True},
            {"name": "id_cliente", "type": "integer", "fk": True},
            {"name": "id_trabajador", "type": "integer", "fk": True},
            {"name": "id_servicio", "type": "integer", "fk": True},
            {"name": "descripcion", "type": "text"},
            {"name": "ubicacion_aprox", "type": "varchar(255)"},
            {"name": "fecha_deseada", "type": "timestamp"},
            {"name": "estado", "type": "varchar(30)"},
            {"name": "urgente", "type": "boolean"},
        ]),
        (600, 1560, "cotizacion_privada", [
            {"name": "id_cotizacion", "type": "integer identity", "pk": True},
            {"name": "id_solicitud", "type": "integer", "fk": True, "uq": True},
            {"name": "id_trabajador", "type": "integer", "fk": True},
            {"name": "monto_estimado", "type": "numeric"},
            {"name": "descripcion_alcance", "type": "text"},
            {"name": "fecha_emision", "type": "timestamp"},
            {"name": "estado", "type": "varchar(30)"},
        ]),
        (1120, 1560, "mensaje", [
            {"name": "id_mensaje", "type": "integer identity", "pk": True},
            {"name": "id_solicitud", "type": "integer", "fk": True},
            {"name": "id_emisor", "type": "integer", "fk": True},
            {"name": "contenido", "type": "text"},
            {"name": "adjunto_url", "type": "varchar(500)"},
            {"name": "fecha_envio", "type": "timestamp"},
        ]),
        (1640, 1560, "resena", [
            {"name": "id_resena", "type": "integer identity", "pk": True},
            {"name": "id_solicitud", "type": "integer", "fk": True, "uq": True},
            {"name": "id_cliente", "type": "integer", "fk": True},
            {"name": "id_trabajador", "type": "integer", "fk": True},
            {"name": "calificacion", "type": "integer 1-5"},
            {"name": "comentario", "type": "text"},
            {"name": "respuesta", "type": "text"},
            {"name": "fecha", "type": "timestamp"},
        ]),
        (2160, 1560, "portafolio", [
            {"name": "id_elemento", "type": "integer identity", "pk": True},
            {"name": "id_perfil", "type": "integer", "fk": True},
            {"name": "titulo", "type": "varchar(150)"},
            {"name": "descripcion", "type": "text"},
            {"name": "imagen_url", "type": "varchar(500)"},
            {"name": "fecha_publicacion", "type": "timestamp"},
        ]),
        (2680, 1560, "reporte", [
            {"name": "id_reporte", "type": "integer identity", "pk": True},
            {"name": "id_usuario_reporta", "type": "integer", "fk": True},
            {"name": "tipo_recurso", "type": "varchar(50)"},
            {"name": "id_recurso", "type": "integer (sin FK)"},
            {"name": "motivo", "type": "text"},
            {"name": "estado", "type": "varchar(30)"},
            {"name": "fecha", "type": "timestamp"},
        ]),
        (80, 2040, "bitacora", [
            {"name": "id_evento", "type": "integer identity", "pk": True},
            {"name": "id_actor", "type": "integer", "fk": True},
            {"name": "accion", "type": "varchar(100)"},
            {"name": "recurso", "type": "varchar(100)"},
            {"name": "fecha_hora", "type": "timestamp"},
            {"name": "origen", "type": "varchar(100)"},
        ]),
    ]
    for x, y, name, cols in tables:
        table(d, x, y, name, cols)

    rounded(d, (600, 2040, 1880, 2480), 10, NOTE, INK, 2)
    text(d, (620, 2070), "Notas de diseno fisico", F18B, INK, "lt")
    notes = [
        "PK = llave primaria identity. FK = llave foranea. UQ = unico.",
        "id_trabajador en solicitud, cotizacion y resena apunta a perfil_trabajador.id_perfil.",
        "perfil_zona tiene PK compuesta (id_perfil, id_zona).",
        "reporte.id_recurso es polimorfico: no lleva FK fisica.",
        "descripcion de perfil_trabajador puede guardar JSON v1 (bio, tarifas, horarios).",
        "Constraints: uq_usuario_correo, uq_perfil_usuario, uq_resena_solicitud,",
        "uq_cotizacion_solicitud, chk_solicitud_estado, chk_resena_calificacion (1-5).",
        "Estados de usuario: ACTIVO, INACTIVO, SUSPENDIDO, ELIMINADO.",
    ]
    for i, note in enumerate(notes):
        text(d, (620, 2110 + i * 40), f"- {note}", F15, INK, "lt")

    d.rectangle((1920, 2040, 3220, 2480), fill=HEADER)
    text(d, (1940, 2070), "Autenticacion JWT + bcrypt", F18B, WHITE, "lt")
    auth = [
        "POST /api/auth/register",
        "  Crea usuario, bcrypt.hash(password, 12) y emite JWT.",
        "POST /api/auth/login",
        "  bcrypt.compare, JWT access + refresh (JWKS).",
        "Guard JwtAuthGuard",
        "  Authorization: Bearer <access_token>",
        "password_hash nunca se expone en la API.",
        "Refresh: POST /api/auth/refresh-token",
    ]
    for i, line in enumerate(auth):
        text(d, (1940, 2114 + i * 40), line, F15, (226, 232, 240), "lt")

    rounded(d, (50, 3560, W - 50, 4120), 16, (255, 250, 242), INK, 2)
    text(d, (80, 3595), "C. Relaciones fisicas (FK)", F28B, INK, "lt")
    fks = [
        "perfil_trabajador.id_usuario -> usuario.id_usuario                          (1:1)",
        "perfil_zona.id_perfil -> perfil_trabajador.id_perfil                        (N:1)",
        "perfil_zona.id_zona -> zona.id_zona                                         (N:1)",
        "servicio_ofrecido.id_perfil -> perfil_trabajador.id_perfil                  (N:1)",
        "servicio_ofrecido.id_categoria -> categoria.id_categoria                    (N:1)",
        "portafolio.id_perfil -> perfil_trabajador.id_perfil                         (N:1)",
        "solicitud_servicio.id_cliente -> usuario.id_usuario                         (N:1)",
        "solicitud_servicio.id_trabajador -> perfil_trabajador.id_perfil             (N:1)",
        "solicitud_servicio.id_servicio -> servicio_ofrecido.id_servicio             (N:1)",
        "cotizacion_privada.id_solicitud -> solicitud_servicio.id_solicitud          (1:1 UNIQUE)",
        "resena.id_solicitud -> solicitud_servicio.id_solicitud                      (1:1 UNIQUE)",
        "mensaje.id_solicitud -> solicitud_servicio.id_solicitud                     (N:1)",
        "mensaje.id_emisor / resena.id_cliente / reporte.id_usuario_reporta / bitacora.id_actor -> usuario.id_usuario",
    ]
    for i, line in enumerate(fks):
        col = 80 if i < 7 else 1680
        row = i if i < 7 else i - 7
        text(d, (col, 3645 + row * 58), f"- {line}", F15, INK, "lt")

    text(d, (70, H - 40), "OficiosYa  |  01_Diagrama_Entidad_Relacion_ERD_Conceptual_y_Fisico  |  23/09/2026", F14, MUTED, "lt")

    png = OUT / f"{STEM}.png"
    pdf = OUT / f"{STEM}.pdf"
    img.save(png, "PNG")
    img.convert("RGB").save(pdf, "PDF", resolution=150.0)
    print(f"wrote {png}")
    print(f"wrote {pdf}")


if __name__ == "__main__":
    main()
