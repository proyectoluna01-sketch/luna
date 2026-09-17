// Oscurece un color hex un porcentaje dado -- se usa para el estado :hover
// de los botones sin tener que guardar dos colores por separado en el admin.
function oscurecerColor(hex, porcentaje) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * porcentaje);
    const r = Math.max(0, (num >> 16) - amt);
    const g = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const b = Math.max(0, (num & 0x0000FF) - amt);
    return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
}

let productosCache = [];
let categoriasCache = [];
let categoriaActiva = null;
let ordenActual = 'recientes';
let carrito = JSON.parse(localStorage.getItem('carrito_tienda') || '[]');
let telefonoNegocio = null;
let nombreNegocioActual = 'Tienda';
let direccionNegocioActual = '';

document.addEventListener('DOMContentLoaded', async () => {
    await cargarConfigNegocio();
    await cargarCategorias();
    await cargarProductos();
    renderCarrito();
    configurarEventos();
    lucide.createIcons();
});

async function cargarConfigNegocio() {
    const { data } = await sb.from('configuracion_negocio').select('*').eq('id', 1).single();
    if (!data) return;
    document.getElementById('header-nombre').textContent = data.nombre_negocio || 'Tienda';
    document.title = data.nombre_negocio || 'Tienda';
    nombreNegocioActual = data.nombre_negocio || 'Tienda';
    direccionNegocioActual = data.direccion || '';
    if (data.logo_url) {
        document.getElementById('header-logo').src = data.logo_url;
        document.getElementById('header-logo').classList.remove('hidden');
    }
    document.getElementById('footer-nombre').textContent = data.nombre_negocio || 'Tienda';
    document.getElementById('footer-nombre-copy').textContent = data.nombre_negocio || 'Tienda';
    document.getElementById('footer-anio').textContent = new Date().getFullYear();
    document.getElementById('footer-direccion').textContent = data.direccion || '';
    document.getElementById('footer-telefono').textContent = data.telefono_contacto ? `Tel: ${data.telefono_contacto}` : '';
    if (data.logo_url) {
        document.getElementById('footer-logo').src = data.logo_url;
        document.getElementById('footer-logo').classList.remove('hidden');
    }
    telefonoNegocio = data.telefono_contacto;

    if (data.telefono_contacto) {
        const telLimpio = data.telefono_contacto.replace(/\D/g, '');
        const mensaje = encodeURIComponent(`Hola! Tengo una pregunta sobre ${data.nombre_negocio || 'la tienda'}.`);
        const urlWhatsapp = `https://wa.me/${telLimpio}?text=${mensaje}`;
        document.getElementById('footer-whatsapp-link').href = urlWhatsapp;
        const btnFlotante = document.getElementById('btn-whatsapp-flotante');
        btnFlotante.href = urlWhatsapp;
        btnFlotante.classList.remove('hidden');
    }

    if (data.instagram_url) {
        // El icono de Instagram no viene en el set base de lucide (lo movieron
        // a un paquete aparte), asi que se usa un SVG propio en vez del data-lucide.
        document.getElementById('footer-redes').innerHTML = `
            <a href="${data.instagram_url}" target="_blank" class="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
            </a>`;
    }

    if (data.color_primario) {
        document.documentElement.style.setProperty('--color-primario', data.color_primario);
        document.documentElement.style.setProperty('--color-primario-hover', oscurecerColor(data.color_primario, 15));
    }

    if (data.mensaje_promocional) {
        const track = document.getElementById('marquee-track');
        const item = `<span class="mx-6">${data.mensaje_promocional}</span>`;
        track.innerHTML = item.repeat(8);
        document.getElementById('barra-promo').classList.remove('hidden');
    }

    if (data.hero_titulo || data.hero_imagen_url) {
        document.getElementById('hero-titulo').textContent = data.hero_titulo || '';
        document.getElementById('hero-descripcion').textContent = data.hero_descripcion || '';
        if (data.hero_imagen_url) document.getElementById('hero-imagen').src = data.hero_imagen_url;
        document.getElementById('seccion-hero').classList.remove('hidden');
    }
}

async function cargarCategorias() {
    const { data } = await sb.from('categorias').select('*').order('nombre');
    categoriasCache = data || [];
    renderCategoriasNav();
}

function renderCategoriasNav() {
    const iconos = document.getElementById('lista-categorias-iconos');
    const iconoCat = (id, nombre, imagen) => `
        <button data-cat="${id ?? ''}" class="chip-categoria flex flex-col items-center gap-1.5 shrink-0">
            <span class="h-16 w-16 rounded-full border-2 ${categoriaActiva === id ? 'border-[var(--color-primario)]' : 'border-[#F1D9DE]'} overflow-hidden bg-[#FDF6F7] flex items-center justify-center">
                ${imagen ? `<img src="${imagen}" class="w-full h-full object-cover">` : '<i data-lucide="sparkles" class="h-6 w-6 text-[#E3BFC6]"></i>'}
            </span>
            <span class="text-[10px] font-semibold uppercase tracking-wide text-[#7D4F58]">${nombre}</span>
        </button>`;
    iconos.innerHTML = iconoCat(null, 'Todo', null) + categoriasCache.map(c => iconoCat(c.id, c.nombre, c.imagen_url)).join('');
    lucide.createIcons();
}

async function cargarProductos() {
    const { data } = await sb.from('productos').select('*, categorias(id, nombre)').order('creado_en', { ascending: false });
    productosCache = data || [];
    renderProductos();
}

function renderProductos() {
    const grid = document.getElementById('grid-productos');
    const sinProductos = document.getElementById('sin-productos');
    let filtrados = categoriaActiva ? productosCache.filter(p => p.categoria_id === categoriaActiva) : productosCache;

    if (ordenActual === 'precio_asc') filtrados = [...filtrados].sort((a, b) => a.precio_venta - b.precio_venta);
    else if (ordenActual === 'precio_desc') filtrados = [...filtrados].sort((a, b) => b.precio_venta - a.precio_venta);

    document.getElementById('contador-productos').textContent = `${filtrados.length} producto${filtrados.length === 1 ? '' : 's'}`;

    if (filtrados.length === 0) {
        grid.innerHTML = '';
        sinProductos.classList.remove('hidden');
        return;
    }
    sinProductos.classList.add('hidden');

    grid.innerHTML = filtrados.map(p => `
        <div class="tarjeta-producto group" data-id="${p.id}">
            <div class="relative aspect-square bg-[#FDF6F7] rounded-xl overflow-hidden mb-3 cursor-pointer">
                ${p.imagen_url
                    ? `<img src="${p.imagen_url}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">`
                    : `<div class="w-full h-full flex items-center justify-center"><i data-lucide="image" class="h-8 w-8 text-[#E3BFC6]"></i></div>`}
                <button class="btn-agregar-rapido absolute bottom-2 right-2 h-9 w-9 rounded-full bg-white/90 shadow flex items-center justify-center text-[var(--color-primario)] hover:bg-[var(--color-primario)] hover:text-white transition sm:opacity-0 sm:group-hover:opacity-100" data-id="${p.id}" title="Agregar al carrito">
                    <i data-lucide="shopping-bag" class="h-4 w-4 pointer-events-none"></i>
                </button>
            </div>
            <div class="cursor-pointer">
                <p class="text-sm text-[#7D4F58] font-medium truncate">${p.nombre}</p>
                <p class="text-[var(--color-primario)] font-semibold">$${parseFloat(p.precio_venta).toFixed(2)}</p>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

let productoModalActual = null;

function abrirModalProducto(id) {
    const p = productosCache.find(x => x.id === id);
    if (!p) return;
    productoModalActual = p;
    document.getElementById('modal-producto-imagen').src = p.imagen_url || '';
    document.getElementById('modal-producto-categoria').textContent = p.categorias?.nombre || '';
    document.getElementById('modal-producto-nombre').textContent = p.nombre;
    document.getElementById('modal-producto-precio').textContent = `$${parseFloat(p.precio_venta).toFixed(2)}`;
    document.getElementById('modal-producto').classList.remove('hidden');
    document.getElementById('modal-producto').classList.add('flex');
}

function cerrarModalProducto() {
    document.getElementById('modal-producto').classList.add('hidden');
    document.getElementById('modal-producto').classList.remove('flex');
}

function guardarCarrito() {
    localStorage.setItem('carrito_tienda', JSON.stringify(carrito));
    renderCarrito();
}

function agregarAlCarrito(producto) {
    const existente = carrito.find(i => i.id === producto.id);
    if (existente) existente.cantidad += 1;
    else carrito.push({ id: producto.id, nombre: producto.nombre, precio: parseFloat(producto.precio_venta), imagen_url: producto.imagen_url, cantidad: 1 });
    guardarCarrito();
    abrirCarrito();
}

function cambiarCantidad(id, delta) {
    const item = carrito.find(i => i.id === id);
    if (!item) return;
    item.cantidad += delta;
    if (item.cantidad <= 0) carrito = carrito.filter(i => i.id !== id);
    guardarCarrito();
}

function renderCarrito() {
    const cont = document.getElementById('items-carrito');
    const contador = document.getElementById('carrito-contador');
    const totalItems = carrito.reduce((acc, i) => acc + i.cantidad, 0);

    if (totalItems > 0) { contador.textContent = totalItems; contador.classList.remove('hidden'); }
    else contador.classList.add('hidden');

    if (carrito.length === 0) {
        cont.innerHTML = '<p class="text-center text-[#B8909A] mt-10">Tu carrito está vacío</p>';
    } else {
        cont.innerHTML = carrito.map(i => `
            <div class="flex items-center gap-3">
                <div class="h-16 w-16 rounded-lg bg-[#FDF6F7] overflow-hidden shrink-0">
                    ${i.imagen_url ? `<img src="${i.imagen_url}" class="w-full h-full object-cover">` : ''}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-[#7D4F58] truncate">${i.nombre}</p>
                    <p class="text-sm text-[#B76E79] font-semibold">$${i.precio.toFixed(2)}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button class="btn-cant-menos w-6 h-6 rounded-full border border-[#EAC7CE] text-[#7D4F58]" data-id="${i.id}">-</button>
                    <span class="text-sm w-4 text-center">${i.cantidad}</span>
                    <button class="btn-cant-mas w-6 h-6 rounded-full border border-[#EAC7CE] text-[#7D4F58]" data-id="${i.id}">+</button>
                </div>
            </div>
        `).join('');
    }

    const total = carrito.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
    document.getElementById('carrito-total').textContent = `$${total.toFixed(2)}`;
}

function abrirCarrito() {
    document.getElementById('panel-carrito').classList.remove('translate-x-full');
    document.getElementById('overlay-carrito').classList.remove('hidden');
}

function cerrarCarrito() {
    document.getElementById('panel-carrito').classList.add('translate-x-full');
    document.getElementById('overlay-carrito').classList.add('hidden');
}

function enviarPedidoWhatsapp() {
    if (carrito.length === 0) return;
    if (!telefonoNegocio) { alert('El negocio aún no configuró un teléfono de contacto.'); return; }

    const lineas = carrito.map(i => `- ${i.cantidad}x ${i.nombre} ($${(i.precio * i.cantidad).toFixed(2)})`).join('\n');
    const total = carrito.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
    const mensaje = `Hola! Quiero hacer este pedido:\n\n${lineas}\n\nTotal: $${total.toFixed(2)}`;
    const telefonoLimpio = telefonoNegocio.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`, '_blank');
}

function configurarEventos() {
    const manejarClickCategoria = (e) => {
        const btn = e.target.closest('.chip-categoria');
        if (!btn) return;
        categoriaActiva = btn.dataset.cat || null;
        renderCategoriasNav();
        renderProductos();
        document.querySelector('main').scrollIntoView({ behavior: 'smooth' });
    };
    document.getElementById('lista-categorias-iconos').addEventListener('click', manejarClickCategoria);

    document.getElementById('btn-hero-comprar')?.addEventListener('click', () => {
        document.querySelector('main').scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('select-orden').addEventListener('change', (e) => {
        ordenActual = e.target.value;
        renderProductos();
    });

    document.getElementById('grid-productos').addEventListener('click', (e) => {
        const btnRapido = e.target.closest('.btn-agregar-rapido');
        if (btnRapido) {
            const producto = productosCache.find(p => p.id === btnRapido.dataset.id);
            if (producto) agregarAlCarrito(producto);
            return;
        }
        const card = e.target.closest('.tarjeta-producto');
        if (card) abrirModalProducto(card.dataset.id);
    });

    document.getElementById('btn-cerrar-modal-producto').addEventListener('click', cerrarModalProducto);
    document.getElementById('modal-producto').addEventListener('click', (e) => {
        if (e.target.id === 'modal-producto') cerrarModalProducto();
    });

    document.getElementById('btn-agregar-carrito').addEventListener('click', () => {
        if (productoModalActual) agregarAlCarrito(productoModalActual);
        cerrarModalProducto();
    });

    document.getElementById('btn-abrir-carrito').addEventListener('click', abrirCarrito);
    document.getElementById('btn-cerrar-carrito').addEventListener('click', cerrarCarrito);
    document.getElementById('overlay-carrito').addEventListener('click', cerrarCarrito);

    document.getElementById('items-carrito').addEventListener('click', (e) => {
        const masBtn = e.target.closest('.btn-cant-mas');
        const menosBtn = e.target.closest('.btn-cant-menos');
        if (masBtn) cambiarCantidad(masBtn.dataset.id, 1);
        if (menosBtn) cambiarCantidad(menosBtn.dataset.id, -1);
    });

    document.getElementById('btn-checkout-whatsapp').addEventListener('click', enviarPedidoWhatsapp);

    document.getElementById('btn-abrir-checkout-yappy').addEventListener('click', abrirModalCheckout);
    document.getElementById('btn-cerrar-checkout').addEventListener('click', cerrarModalCheckout);
    document.getElementById('btn-continuar-checkout').addEventListener('click', continuarCheckoutYappy);
    document.getElementById('btn-descargar-recibo').addEventListener('click', generarReciboPDF);

    configurarBotonYappy();
}

// ===================== RECIBO PDF =====================
let ultimaOrdenConfirmada = null;

function generarReciboPDF() {
    if (!ultimaOrdenConfirmada || !window.jspdf) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const orden = ultimaOrdenConfirmada;
    const margenIzq = 48;
    let y = 60;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(nombreNegocioActual, margenIzq, y);
    y += 20;
    if (direccionNegocioActual) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(direccionNegocioActual, margenIzq, y);
        y += 25;
    } else {
        y += 10;
    }

    doc.setDrawColor(200);
    doc.line(margenIzq, y, 547, y);
    y += 25;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Orden de compra', margenIzq, y);
    y += 20;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Referencia: ${orden.orderId || '-'}`, margenIzq, y); y += 15;
    doc.text(`Fecha: ${new Date().toLocaleString('es-PA')}`, margenIzq, y); y += 15;
    doc.text(`Cliente: ${orden.nombre || '-'}`, margenIzq, y); y += 15;
    doc.text(`Teléfono: ${orden.telefono || '-'}`, margenIzq, y); y += 15;
    if (orden.direccion) { doc.text(`Entrega: ${orden.direccion}`, margenIzq, y); y += 15; }
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('Producto', margenIzq, y);
    doc.text('Cant.', 380, y);
    doc.text('Subtotal', 460, y);
    y += 8;
    doc.line(margenIzq, y, 547, y);
    y += 18;

    doc.setFont('helvetica', 'normal');
    orden.items.forEach(item => {
        doc.text(item.nombre, margenIzq, y, { maxWidth: 300 });
        doc.text(String(item.cantidad), 380, y);
        doc.text(`$${(item.precio * item.cantidad).toFixed(2)}`, 460, y);
        y += 20;
    });

    y += 10;
    doc.line(margenIzq, y, 547, y);
    y += 22;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`Total: $${parseFloat(orden.total).toFixed(2)}`, margenIzq, y);

    y += 40;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.text('¡Gracias por tu compra!', margenIzq, y);

    doc.save(`orden-${orden.orderId || Date.now()}.pdf`);
}

// ===================== CHECKOUT CON YAPPY =====================
const EDGE_FUNCTION_YAPPY_URL = `${SUPABASE_URL}/functions/v1/yappy-push`;
let yappyOrderIdActual = null;
let yappyMontoActivo = 0;

function abrirModalCheckout() {
    if (carrito.length === 0) return;
    document.getElementById('checkout-form').classList.remove('hidden');
    document.getElementById('checkout-yappy-wrapper').classList.add('hidden');
    document.getElementById('checkout-yappy-wrapper').classList.remove('flex');
    document.getElementById('checkout-error').classList.add('hidden');
    document.getElementById('checkout-estado').textContent = '';
    document.getElementById('btn-descargar-recibo').classList.add('hidden');
    document.getElementById('btn-descargar-recibo').classList.remove('flex');
    document.getElementById('modal-checkout').classList.remove('hidden');
    document.getElementById('modal-checkout').classList.add('flex');
}

function cerrarModalCheckout() {
    document.getElementById('modal-checkout').classList.add('hidden');
    document.getElementById('modal-checkout').classList.remove('flex');
}

async function continuarCheckoutYappy() {
    const nombre = document.getElementById('checkout-nombre').value.trim();
    const telefono = document.getElementById('checkout-telefono').value.trim().replace(/\D/g, '');
    const direccion = document.getElementById('checkout-direccion').value.trim();
    const errorEl = document.getElementById('checkout-error');

    if (!nombre || telefono.length < 8) {
        errorEl.textContent = 'Escribe tu nombre y un teléfono válido.';
        errorEl.classList.remove('hidden');
        return;
    }

    const total = carrito.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
    const { data: orderId, error } = await sb.rpc('crear_pedido_pendiente_pago', {
        p_carrito: carrito,
        p_nombre: nombre,
        p_telefono: telefono,
        p_direccion: direccion || null,
        p_tipo_entrega: direccion ? 'Delivery' : 'Tienda',
        p_monto: total
    });

    if (error || !orderId) {
        errorEl.textContent = 'No se pudo iniciar el pago. Intenta de nuevo.';
        errorEl.classList.remove('hidden');
        return;
    }

    yappyOrderIdActual = orderId;
    yappyMontoActivo = total;

    document.getElementById('checkout-form').classList.add('hidden');
    document.getElementById('checkout-monto').textContent = `$${total.toFixed(2)}`;
    document.getElementById('checkout-yappy-wrapper').classList.remove('hidden');
    document.getElementById('checkout-yappy-wrapper').classList.add('flex');
}

function configurarBotonYappy() {
    const btnYappy = document.getElementById('btn-yappy-component');
    if (!btnYappy) return;

    btnYappy.addEventListener('eventClick', async () => {
        const telefono = document.getElementById('checkout-telefono').value.trim().replace(/\D/g, '');
        const estadoEl = document.getElementById('checkout-estado');
        try {
            btnYappy.setAttribute('isButtonLoading', 'true');
            const resp = await fetch(EDGE_FUNCTION_YAPPY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    monto: yappyMontoActivo,
                    telefono,
                    domain: window.location.origin,
                    order_id: yappyOrderIdActual
                })
            });
            const data = await resp.json();
            if (data.error) throw new Error(data.error);
            btnYappy.eventPayment({ transactionId: data.transactionId, documentName: data.documentName, token: data.token });
        } catch (err) {
            btnYappy.setAttribute('isButtonLoading', 'false');
            estadoEl.textContent = 'Error: ' + err.message;
            estadoEl.className = 'text-sm text-center text-red-600';
        }
    });

    btnYappy.addEventListener('eventSuccess', () => {
        btnYappy.setAttribute('isButtonLoading', 'false');
        document.getElementById('checkout-estado').textContent = '¡Pago confirmado! Gracias por tu compra.';
        document.getElementById('checkout-estado').className = 'text-sm text-center text-emerald-600 font-semibold';

        ultimaOrdenConfirmada = {
            orderId: yappyOrderIdActual,
            nombre: document.getElementById('checkout-nombre').value.trim(),
            telefono: document.getElementById('checkout-telefono').value.trim(),
            direccion: document.getElementById('checkout-direccion').value.trim(),
            items: carrito.map(i => ({ ...i })),
            total: yappyMontoActivo
        };
        document.getElementById('btn-descargar-recibo').classList.remove('hidden');
        document.getElementById('btn-descargar-recibo').classList.add('flex');

        carrito = [];
        guardarCarrito();
        cerrarCarrito();
    });

    btnYappy.addEventListener('eventError', () => {
        btnYappy.setAttribute('isButtonLoading', 'false');
        document.getElementById('checkout-estado').textContent = 'Pago cancelado o falló la conexión.';
        document.getElementById('checkout-estado').className = 'text-sm text-center text-red-600';
    });
}
