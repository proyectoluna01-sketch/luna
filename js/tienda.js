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

// Los nombres de productos/categorias los escribe el admin; se escapan antes de meterlos como HTML.
function escaparHtml(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Minusculas y sin acentos, para que "labial" encuentre "Lábial" y viceversa.
function normalizarTexto(texto) {
    return String(texto ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// stock null = sin control de stock (siempre disponible); 0 = agotado
const estaAgotado = (p) => p.stock !== null && p.stock !== undefined && p.stock <= 0;
const cantidadMaxima = (p) => (p.stock === null || p.stock === undefined) ? 99 : p.stock;

const DIAS_PRODUCTO_NUEVO = 14;
const esProductoNuevo = (p) => p.creado_en && (Date.now() - new Date(p.creado_en).getTime()) < DIAS_PRODUCTO_NUEVO * 86400000;

let productosCache = [];
let categoriasCache = [];
let categoriaActiva = null;
let busqueda = '';
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
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', data.nombre_negocio || 'Tienda');
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

    // WhatsApp: boton flotante, boton del footer (solo con telefono) y su icono en las redes
    const ICONO_WHATSAPP = '<svg viewBox="0 0 24 24" class="h-[18px] w-[18px] fill-current" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';
    // El icono de Instagram no viene en el set base de lucide, asi que se usa un SVG propio.
    const ICONO_INSTAGRAM = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>';
    const redes = [];
    let urlWhatsapp = null;

    if (data.telefono_contacto) {
        const telLimpio = data.telefono_contacto.replace(/\D/g, '');
        const mensaje = encodeURIComponent(`Hola! Tengo una pregunta sobre ${data.nombre_negocio || 'la tienda'}.`);
        urlWhatsapp = `https://wa.me/${telLimpio}?text=${mensaje}`;
        document.getElementById('footer-whatsapp-link').href = urlWhatsapp;
        const btnFlotante = document.getElementById('btn-whatsapp-flotante');
        btnFlotante.href = urlWhatsapp;
        btnFlotante.classList.remove('hidden');
        redes.push({ url: urlWhatsapp, icono: ICONO_WHATSAPP, nombre: 'WhatsApp', fondo: '#25D366' });
    } else {
        document.getElementById('footer-whatsapp-link').style.display = 'none';
    }

    instagramUrlActual = /^https?:\/\//i.test(data.instagram_url || '') ? data.instagram_url : null;
    if (instagramUrlActual) {
        redes.push({ url: instagramUrlActual, icono: ICONO_INSTAGRAM, nombre: 'Instagram',
                     fondo: 'linear-gradient(45deg,#F9CE34,#EE2A7B 55%,#6228D7)' });
    }

    document.getElementById('footer-redes').innerHTML = redes.map(r => `
        <a href="${escaparHtml(r.url)}" target="_blank" rel="noopener" aria-label="${r.nombre}" title="${r.nombre}"
           class="h-10 w-10 rounded-full text-white flex items-center justify-center shadow-md shadow-black/20 transition hover:-translate-y-0.5 hover:brightness-110"
           style="background:${r.fondo};">${r.icono}</a>`).join('');

    if (data.color_primario) {
        document.documentElement.style.setProperty('--color-primario', data.color_primario);
        document.documentElement.style.setProperty('--color-primario-hover', oscurecerColor(data.color_primario, 15));
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', data.color_primario);
    }

    // Color de las categorias (sin color propio = el principal) y su version mas oscura para la seleccionada
    const colorCategorias = data.color_categorias || data.color_primario;
    if (colorCategorias) {
        document.documentElement.style.setProperty('--color-categorias', colorCategorias);
        document.documentElement.style.setProperty('--color-categorias-oscuro', oscurecerColor(colorCategorias, 25));
    }

    // Color del footer; si es claro, el texto del footer pasa a oscuro
    if (data.color_footer) {
        document.documentElement.style.setProperty('--color-footer', data.color_footer);
        const n = parseInt(data.color_footer.replace('#', ''), 16);
        const luminancia = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
        document.getElementById('footer-tienda')?.classList.toggle('footer-claro', luminancia > 0.6);
    }

    if (data.mensaje_promocional) {
        const track = document.getElementById('marquee-track');
        const item = `<span class="mx-6">${data.mensaje_promocional}</span>`;
        track.innerHTML = item.repeat(8);
        const barraPromo = document.getElementById('barra-promo');
        barraPromo.classList.remove('hidden');
        // Si el admin eligio un destino, la barra es un enlace a esa seccion
        promoDestino = data.promo_destino || null;
        if (promoDestino) {
            barraPromo.style.cursor = 'pointer';
            barraPromo.setAttribute('role', 'link');
            barraPromo.setAttribute('tabindex', '0');
            barraPromo.addEventListener('click', irAlDestinoDeLaBarra);
            barraPromo.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); irAlDestinoDeLaBarra(); } });
        }
    }

    if (data.hero_titulo || data.hero_imagen_url) {
        document.getElementById('hero-titulo').textContent = data.hero_titulo || '';
        document.getElementById('hero-descripcion').textContent = data.hero_descripcion || '';
        if (data.hero_imagen_url) document.getElementById('hero-imagen').src = data.hero_imagen_url;
        document.getElementById('seccion-hero').classList.remove('hidden');
    }
}

// A donde lleva la barra promocional: 'productos' | 'cat:<id>' | 'contacto' | 'instagram' (configurable en el admin)
let promoDestino = null;
let instagramUrlActual = null;

function irAlDestinoDeLaBarra() {
    if (!promoDestino) return;
    if (promoDestino === 'productos' || promoDestino.startsWith('cat:')) {
        const idCategoria = promoDestino.startsWith('cat:') ? promoDestino.slice(4) : null;
        categoriaActiva = idCategoria && categoriasCache.some(c => c.id === idCategoria) ? idCategoria : null;
        busqueda = '';
        const input = document.getElementById('input-busqueda');
        if (input) input.value = '';
        renderCategoriasNav();
        renderProductos();
        document.querySelector('main').scrollIntoView({ behavior: 'smooth' });
    } else if (promoDestino === 'contacto') {
        document.getElementById('footer-contacto')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (promoDestino === 'instagram' && instagramUrlActual) {
        window.open(instagramUrlActual, '_blank', 'noopener');
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
            <span class="circulo-categoria ${categoriaActiva === id ? 'seleccionada' : ''} h-16 w-16 rounded-full overflow-hidden bg-[#FDF6F7] flex items-center justify-center">
                ${imagen ? `<img src="${imagen}" alt="" loading="lazy" decoding="async" class="w-full h-full object-cover">` : '<i data-lucide="sparkles" class="h-6 w-6 text-[#E3BFC6]"></i>'}
            </span>
            <span class="text-[10px] font-semibold uppercase tracking-wide text-[#7D4F58]">${escaparHtml(nombre)}</span>
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

    const terminos = normalizarTexto(busqueda).split(/\s+/).filter(Boolean);
    if (terminos.length) {
        filtrados = filtrados.filter(p => {
            const texto = normalizarTexto(`${p.nombre} ${p.categorias?.nombre || ''}`);
            return terminos.every(t => texto.includes(t));
        });
    }

    if (ordenActual === 'precio_asc') filtrados = [...filtrados].sort((a, b) => a.precio_venta - b.precio_venta);
    else if (ordenActual === 'precio_desc') filtrados = [...filtrados].sort((a, b) => b.precio_venta - a.precio_venta);

    document.getElementById('contador-productos').textContent = `${filtrados.length} producto${filtrados.length === 1 ? '' : 's'}`;

    if (filtrados.length === 0) {
        grid.innerHTML = '';
        sinProductos.textContent = busqueda.trim()
            ? `No encontramos productos para "${busqueda.trim()}".`
            : 'No se encontró ningún producto.';
        sinProductos.classList.remove('hidden');
        return;
    }
    sinProductos.classList.add('hidden');

    grid.innerHTML = filtrados.map((p, i) => `
        <div class="tarjeta-producto group" data-id="${p.id}" style="animation-delay:${Math.min(i, 12) * 40}ms">
            <div class="relative aspect-square bg-[#FDF6F7] rounded-xl overflow-hidden mb-3 cursor-pointer">
                ${estaAgotado(p)
                    ? `<span class="absolute top-2 left-2 z-10 bg-[#3E2C30] text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">Agotado</span>`
                    : (esProductoNuevo(p) ? `<span class="absolute top-2 left-2 z-10 bg-[var(--color-primario)] text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">Nuevo</span>` : '')}
                ${p.imagen_url
                    ? `<img src="${p.imagen_url}" alt="${escaparHtml(p.nombre)}" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-105 transition duration-500 ${estaAgotado(p) ? 'opacity-50' : ''}">`
                    : `<div class="w-full h-full flex items-center justify-center"><i data-lucide="image" class="h-8 w-8 text-[#E3BFC6]"></i></div>`}
                ${estaAgotado(p) ? '' : `<button class="btn-agregar-rapido absolute bottom-2 right-2 h-9 w-9 rounded-full bg-white/90 shadow flex items-center justify-center text-[var(--color-primario)] hover:bg-[var(--color-primario)] hover:text-white transition sm:opacity-0 sm:group-hover:opacity-100" data-id="${p.id}" title="Agregar al carrito">
                    <i data-lucide="shopping-bag" class="h-4 w-4 pointer-events-none"></i>
                </button>`}
            </div>
            <div class="cursor-pointer">
                <p class="text-sm text-[#7D4F58] font-medium truncate">${escaparHtml(p.nombre)}</p>
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
    const fotos = [p.imagen_url, ...(Array.isArray(p.galeria) ? p.galeria : [])].filter(Boolean);
    const imgPrincipal = document.getElementById('modal-producto-imagen');
    imgPrincipal.src = fotos[0] || '';
    imgPrincipal.alt = p.nombre;
    const miniaturas = document.getElementById('modal-producto-miniaturas');
    if (fotos.length > 1) {
        miniaturas.innerHTML = fotos.map((url, i) => `
            <button type="button" class="miniatura-foto shrink-0 h-14 w-14 rounded-lg overflow-hidden border-2 ${i === 0 ? 'border-[var(--color-primario)]' : 'border-transparent'}" data-url="${escaparHtml(url)}">
                <img src="${escaparHtml(url)}" alt="" loading="lazy" class="h-full w-full object-cover pointer-events-none">
            </button>`).join('');
        miniaturas.classList.remove('hidden');
    } else {
        miniaturas.innerHTML = '';
        miniaturas.classList.add('hidden');
    }
    document.getElementById('modal-producto-categoria').textContent = p.categorias?.nombre || '';
    document.getElementById('modal-producto-nombre').textContent = p.nombre;
    document.getElementById('modal-producto-precio').textContent = `$${parseFloat(p.precio_venta).toFixed(2)}`;

    const desc = document.getElementById('modal-producto-descripcion');
    desc.textContent = p.descripcion || '';
    desc.classList.toggle('hidden', !p.descripcion);

    const aviso = document.getElementById('modal-producto-stock');
    const btnAgregar = document.getElementById('btn-agregar-carrito');
    aviso.className = 'text-xs font-semibold mb-3';
    if (estaAgotado(p)) {
        aviso.textContent = 'Agotado';
        aviso.classList.add('text-red-600');
        btnAgregar.disabled = true;
        btnAgregar.textContent = 'Agotado';
    } else {
        btnAgregar.disabled = false;
        btnAgregar.textContent = 'Agregar al carrito';
        if (p.stock !== null && p.stock !== undefined && p.stock <= 5) {
            aviso.textContent = p.stock === 1 ? 'Última unidad' : `Quedan ${p.stock} unidades`;
            aviso.classList.add('text-amber-600');
        } else {
            aviso.classList.add('hidden');
        }
    }
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
    if (estaAgotado(producto)) { mostrarAviso('Este producto está agotado'); return; }
    const existente = carrito.find(i => i.id === producto.id);
    if (existente && existente.cantidad + 1 > cantidadMaxima(producto)) {
        mostrarAviso(`Solo quedan ${cantidadMaxima(producto)} unidades`);
        return;
    }
    if (existente) existente.cantidad += 1;
    else carrito.push({ id: producto.id, nombre: producto.nombre, precio: parseFloat(producto.precio_venta), imagen_url: producto.imagen_url, cantidad: 1 });
    guardarCarrito();
    mostrarAvisoAgregado(producto.nombre);
}

// Aviso breve "Agregado" + salto del contador del carrito (en vez de abrir el panel de golpe)
let temporizadorAviso = null;
function mostrarAviso(texto) {
    const toast = document.getElementById('toast-tienda');
    if (!toast) return;
    document.getElementById('toast-tienda-texto').textContent = texto;
    toast.classList.remove('opacity-0', 'translate-y-2');
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => toast.classList.add('opacity-0', 'translate-y-2'), 1800);
}

function mostrarAvisoAgregado(nombre) {
    mostrarAviso(`Agregado: ${nombre}`);
    const contador = document.getElementById('carrito-contador');
    contador.classList.remove('contador-salto');
    void contador.offsetWidth; // reinicia la animacion si se agrega varias veces seguidas
    contador.classList.add('contador-salto');
}

function cambiarCantidad(id, delta) {
    const item = carrito.find(i => i.id === id);
    if (!item) return;
    const producto = productosCache.find(p => p.id === id);
    if (delta > 0 && producto && item.cantidad + delta > cantidadMaxima(producto)) {
        mostrarAviso(`Solo quedan ${cantidadMaxima(producto)} unidades`);
        return;
    }
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
                    ${i.imagen_url ? `<img src="${i.imagen_url}" alt="" loading="lazy" class="w-full h-full object-cover">` : ''}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-[#7D4F58] truncate">${escaparHtml(i.nombre)}</p>
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

    // Buscador: la lupa abre/cierra la barra; se filtra mientras se escribe
    const barraBusqueda = document.getElementById('barra-busqueda');
    const inputBusqueda = document.getElementById('input-busqueda');
    const btnLimpiar = document.getElementById('btn-limpiar-busqueda');
    document.getElementById('btn-buscar').addEventListener('click', () => {
        const abrir = barraBusqueda.classList.contains('hidden');
        barraBusqueda.classList.toggle('hidden', !abrir);
        if (abrir) inputBusqueda.focus();
        else if (busqueda) { busqueda = ''; inputBusqueda.value = ''; btnLimpiar.classList.add('hidden'); renderProductos(); }
    });
    inputBusqueda.addEventListener('input', () => {
        busqueda = inputBusqueda.value;
        btnLimpiar.classList.toggle('hidden', !busqueda);
        renderProductos();
    });
    inputBusqueda.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { inputBusqueda.blur(); document.querySelector('main').scrollIntoView({ behavior: 'smooth' }); }
    });
    btnLimpiar.addEventListener('click', () => {
        busqueda = ''; inputBusqueda.value = ''; btnLimpiar.classList.add('hidden');
        renderProductos(); inputBusqueda.focus();
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

    // Miniaturas del producto: cambian la foto grande
    document.getElementById('modal-producto-miniaturas').addEventListener('click', (e) => {
        const btn = e.target.closest('.miniatura-foto');
        if (!btn) return;
        document.getElementById('modal-producto-imagen').src = btn.dataset.url;
        document.querySelectorAll('#modal-producto-miniaturas .miniatura-foto').forEach(b => {
            b.classList.toggle('border-[var(--color-primario)]', b === btn);
            b.classList.toggle('border-transparent', b !== btn);
        });
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
        // Los mensajes de la base de datos (sin stock, precio cambio, etc.) ya vienen en lenguaje claro
        errorEl.textContent = error?.message || 'No se pudo iniciar el pago. Intenta de nuevo.';
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
