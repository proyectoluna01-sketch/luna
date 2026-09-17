let sesionActual = null;
let categoriasCache = [];
let productosCache = [];
let logoNuevoUrl = null;
let productoImagenNuevaUrl = null;
let heroImagenNuevaUrl = null;
let nuevaCategoriaImagenUrl = null;

document.addEventListener('DOMContentLoaded', async () => {
    sesionActual = await Sesion.requerir();
    if (!sesionActual) return;

    document.getElementById('sidebar-usuario').textContent = sesionActual.nombre;
    lucide.createIcons();

    document.getElementById('btn-logout').addEventListener('click', () => Sesion.cerrar());

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => cambiarTab(btn.dataset.tab));
    });

    await cargarConfigNegocio();
    await cargarCategorias();
    await cargarProductos();
    await cargarConfigPagos();

    configurarEventosConfig();
    configurarEventosCategorias();
    configurarEventosProductos();
    configurarEventosPagos();

    cambiarTab('config');
});

function cambiarTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tab}`).classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('bg-[#734953]', b.dataset.tab === tab));
}

function mostrarMensaje(el, texto, tipo = 'success') {
    el.textContent = texto;
    el.className = `text-sm ${tipo === 'success' ? 'text-emerald-600' : 'text-red-600'}`;
    setTimeout(() => el.classList.add('hidden'), 3000);
}

// ===================== CONFIGURACION DEL NEGOCIO =====================
async function cargarConfigNegocio() {
    const { data } = await sb.from('configuracion_negocio').select('*').eq('id', 1).single();
    if (!data) return;
    document.getElementById('cfg-nombre').value = data.nombre_negocio || '';
    document.getElementById('cfg-color').value = data.color_primario || '#000000';
    document.getElementById('cfg-telefono').value = data.telefono_contacto || '';
    document.getElementById('cfg-direccion').value = data.direccion || '';
    document.getElementById('cfg-promo').value = data.mensaje_promocional || '';
    document.getElementById('cfg-instagram').value = data.instagram_url || '';
    document.getElementById('cfg-hero-titulo').value = data.hero_titulo || '';
    document.getElementById('cfg-hero-descripcion').value = data.hero_descripcion || '';
    document.getElementById('sidebar-nombre-negocio').textContent = data.nombre_negocio || 'Panel Admin';
    if (data.logo_url) {
        document.getElementById('preview-logo').src = data.logo_url;
        document.getElementById('preview-logo').classList.remove('hidden');
    }
    if (data.hero_imagen_url) {
        document.getElementById('preview-hero').src = data.hero_imagen_url;
        document.getElementById('preview-hero').classList.remove('hidden');
    }
}

function configurarEventosConfig() {
    document.getElementById('input-logo').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const preview = document.getElementById('preview-logo');
        preview.src = URL.createObjectURL(file);
        preview.classList.remove('hidden');
        try {
            logoNuevoUrl = await subirImagen(file, 'logos');
        } catch (err) {
            alert('Error al subir el logo: ' + err.message);
        }
    });

    document.getElementById('btn-guardar-config').addEventListener('click', async () => {
        const msg = document.getElementById('config-msg');
        const { data, error } = await sb.rpc('admin_guardar_config_negocio', {
            p_token: sesionActual.token,
            p_nombre_negocio: document.getElementById('cfg-nombre').value.trim(),
            p_logo_url: logoNuevoUrl,
            p_color_primario: document.getElementById('cfg-color').value,
            p_telefono_contacto: document.getElementById('cfg-telefono').value.trim() || null,
            p_direccion: document.getElementById('cfg-direccion').value.trim() || null,
            p_mensaje_promocional: document.getElementById('cfg-promo').value.trim() || null,
            p_hero_titulo: document.getElementById('cfg-hero-titulo').value.trim() || null,
            p_hero_descripcion: document.getElementById('cfg-hero-descripcion').value.trim() || null,
            p_hero_imagen_url: heroImagenNuevaUrl,
            p_instagram_url: document.getElementById('cfg-instagram').value.trim() || null
        });
        msg.classList.remove('hidden');
        if (error || !data?.success) {
            mostrarMensaje(msg, 'Error al guardar', 'error');
        } else {
            mostrarMensaje(msg, 'Guardado correctamente');
            document.getElementById('sidebar-nombre-negocio').textContent = document.getElementById('cfg-nombre').value.trim();
        }
    });

    document.getElementById('input-hero').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const preview = document.getElementById('preview-hero');
        preview.src = URL.createObjectURL(file);
        preview.classList.remove('hidden');
        try {
            heroImagenNuevaUrl = await subirImagen(file, 'productos');
        } catch (err) {
            alert('Error al subir la imagen: ' + err.message);
        }
    });

    document.getElementById('btn-guardar-hero').addEventListener('click', () => {
        document.getElementById('btn-guardar-config').click();
        document.getElementById('hero-msg').classList.remove('hidden');
        mostrarMensaje(document.getElementById('hero-msg'), 'Guardado correctamente');
    });
}

// ===================== CATEGORIAS =====================
async function cargarCategorias() {
    const { data } = await sb.from('categorias').select('*').order('nombre');
    categoriasCache = data || [];
    renderCategorias();
    renderSelectCategoriasProducto();
}

function renderCategorias() {
    const cont = document.getElementById('lista-categorias');
    if (categoriasCache.length === 0) {
        cont.innerHTML = '<p class="text-slate-400 text-sm">Aun no hay categorias.</p>';
        return;
    }
    cont.innerHTML = categoriasCache.map(c => `
        <div class="bg-white rounded-lg border p-3 flex justify-between items-center">
            <div class="flex items-center gap-3">
                <button class="btn-cambiar-imagen-categoria h-10 w-10 rounded-full overflow-hidden bg-[#FDF6F7] border border-[#F1D9DE] shrink-0 relative group" data-id="${c.id}" title="Cambiar foto">
                    ${c.imagen_url ? `<img src="${c.imagen_url}" class="h-full w-full object-cover">` : ''}
                    <span class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition"><i data-lucide="camera" class="h-4 w-4 text-white pointer-events-none"></i></span>
                </button>
                <span class="font-medium text-slate-700">${c.nombre}</span>
            </div>
            <div class="flex gap-1">
                <button class="btn-editar-categoria text-slate-400 hover:text-slate-700 p-1" data-id="${c.id}" title="Cambiar nombre"><i data-lucide="pencil" class="h-4 w-4 pointer-events-none"></i></button>
                <button class="btn-borrar-categoria text-red-400 hover:text-red-600 p-1" data-id="${c.id}"><i data-lucide="trash-2" class="h-4 w-4 pointer-events-none"></i></button>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

function configurarEventosCategorias() {
    document.getElementById('nueva-categoria-imagen').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            nuevaCategoriaImagenUrl = await subirImagen(file, 'productos');
        } catch (err) {
            alert('Error al subir la imagen: ' + err.message);
        }
    });

    document.getElementById('btn-crear-categoria').addEventListener('click', async () => {
        const input = document.getElementById('nueva-categoria');
        const nombre = input.value.trim();
        if (!nombre) return;
        const { data, error } = await sb.rpc('admin_guardar_categoria', { p_token: sesionActual.token, p_id: null, p_nombre: nombre, p_imagen_url: nuevaCategoriaImagenUrl });
        if (error || !data?.success) { alert('Error al crear la categoria'); return; }
        input.value = '';
        nuevaCategoriaImagenUrl = null;
        document.getElementById('nueva-categoria-imagen').value = '';
        await cargarCategorias();
    });

    document.getElementById('lista-categorias').addEventListener('click', async (e) => {
        const btnBorrar = e.target.closest('.btn-borrar-categoria');
        const btnEditar = e.target.closest('.btn-editar-categoria');
        const btnImagen = e.target.closest('.btn-cambiar-imagen-categoria');

        if (btnBorrar) {
            if (!confirm('Borrar esta categoria?')) return;
            const { data, error } = await sb.rpc('admin_eliminar_categoria', { p_token: sesionActual.token, p_id: btnBorrar.dataset.id });
            if (error || !data?.success) { alert(data?.message || 'Error al borrar'); return; }
            await cargarCategorias();
        }

        if (btnEditar) {
            const cat = categoriasCache.find(c => c.id === btnEditar.dataset.id);
            const nuevoNombre = prompt('Nuevo nombre de la categoria:', cat?.nombre || '');
            if (!nuevoNombre || !nuevoNombre.trim()) return;
            const { data, error } = await sb.rpc('admin_guardar_categoria', { p_token: sesionActual.token, p_id: btnEditar.dataset.id, p_nombre: nuevoNombre.trim(), p_imagen_url: null });
            if (error || !data?.success) { alert('Error al renombrar'); return; }
            await cargarCategorias();
        }

        if (btnImagen) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async () => {
                const file = input.files[0];
                if (!file) return;
                try {
                    const url = await subirImagen(file, 'productos');
                    const cat = categoriasCache.find(c => c.id === btnImagen.dataset.id);
                    const { data, error } = await sb.rpc('admin_guardar_categoria', { p_token: sesionActual.token, p_id: btnImagen.dataset.id, p_nombre: cat.nombre, p_imagen_url: url });
                    if (error || !data?.success) { alert('Error al cambiar la foto'); return; }
                    await cargarCategorias();
                } catch (err) {
                    alert('Error al subir la imagen: ' + err.message);
                }
            };
            input.click();
        }
    });
}

function renderSelectCategoriasProducto() {
    const select = document.getElementById('prod-categoria');
    select.innerHTML = '<option value="">Sin categoria</option>' +
        categoriasCache.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
}

// ===================== PRODUCTOS =====================
async function cargarProductos() {
    const { data } = await sb.from('productos').select('*, categorias(nombre)').eq('archivado', false).order('creado_en', { ascending: false });
    productosCache = data || [];
    renderProductos();
}

function renderProductos() {
    const cont = document.getElementById('lista-productos');
    if (productosCache.length === 0) {
        cont.innerHTML = '<p class="text-slate-400 text-sm">Aun no hay productos.</p>';
        return;
    }
    cont.innerHTML = productosCache.map(p => `
        <div class="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div class="h-36 bg-slate-100 flex items-center justify-center">
                ${p.imagen_url ? `<img src="${p.imagen_url}" class="h-full w-full object-cover">` : '<i data-lucide="image" class="h-8 w-8 text-slate-300"></i>'}
            </div>
            <div class="p-3">
                <p class="font-semibold text-slate-700 truncate">${p.nombre}</p>
                <p class="text-xs text-slate-400">${p.categorias?.nombre || 'Sin categoria'}</p>
                <div class="flex justify-between items-center mt-2">
                    <span class="font-bold text-emerald-700">$${parseFloat(p.precio_venta).toFixed(2)}</span>
                    <div class="flex gap-1">
                        <button class="btn-editar-producto text-slate-400 hover:text-slate-700 p-1" data-id="${p.id}"><i data-lucide="pencil" class="h-4 w-4 pointer-events-none"></i></button>
                        <button class="btn-borrar-producto text-red-400 hover:text-red-600 p-1" data-id="${p.id}"><i data-lucide="trash-2" class="h-4 w-4 pointer-events-none"></i></button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

function abrirModalProducto(producto = null) {
    productoImagenNuevaUrl = null;
    document.getElementById('modal-producto-titulo').textContent = producto ? 'Editar producto' : 'Nuevo producto';
    document.getElementById('prod-id').value = producto?.id || '';
    document.getElementById('prod-nombre').value = producto?.nombre || '';
    document.getElementById('prod-categoria').value = producto?.categoria_id || '';
    document.getElementById('prod-precio').value = producto?.precio_venta || '';
    const preview = document.getElementById('prod-preview-imagen');
    if (producto?.imagen_url) { preview.src = producto.imagen_url; preview.classList.remove('hidden'); }
    else { preview.classList.add('hidden'); }
    document.getElementById('prod-input-imagen').value = '';
    document.getElementById('modal-producto').classList.remove('hidden');
    document.getElementById('modal-producto').classList.add('flex');
}

function cerrarModalProducto() {
    document.getElementById('modal-producto').classList.add('hidden');
    document.getElementById('modal-producto').classList.remove('flex');
}

// ===================== PAGOS =====================
async function cargarConfigPagos() {
    const { data } = await sb.rpc('admin_obtener_config_pagos', { p_token: sesionActual.token });
    if (data?.success) document.getElementById('pagos-yappy-merchant').value = data.yappy_merchant_id || '';
}

function configurarEventosPagos() {
    document.getElementById('btn-guardar-pagos').addEventListener('click', async () => {
        const msg = document.getElementById('pagos-msg');
        const { data, error } = await sb.rpc('admin_guardar_config_pagos', {
            p_token: sesionActual.token,
            p_yappy_merchant_id: document.getElementById('pagos-yappy-merchant').value.trim() || null
        });
        msg.classList.remove('hidden');
        if (error || !data?.success) mostrarMensaje(msg, 'Error al guardar', 'error');
        else mostrarMensaje(msg, 'Guardado correctamente');
    });
}

function configurarEventosProductos() {
    document.getElementById('btn-nuevo-producto').addEventListener('click', () => abrirModalProducto());
    document.getElementById('btn-cancelar-producto').addEventListener('click', cerrarModalProducto);

    document.getElementById('prod-input-imagen').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const preview = document.getElementById('prod-preview-imagen');
        preview.src = URL.createObjectURL(file);
        preview.classList.remove('hidden');
        try {
            productoImagenNuevaUrl = await subirImagen(file, 'productos');
        } catch (err) {
            alert('Error al subir la imagen: ' + err.message);
        }
    });

    document.getElementById('btn-guardar-producto').addEventListener('click', async () => {
        const id = document.getElementById('prod-id').value || null;
        const nombre = document.getElementById('prod-nombre').value.trim();
        const categoriaId = document.getElementById('prod-categoria').value || null;
        const precio = parseFloat(document.getElementById('prod-precio').value);

        if (!nombre || isNaN(precio)) { alert('Nombre y precio son obligatorios'); return; }

        const { data, error } = await sb.rpc('admin_guardar_producto', {
            p_token: sesionActual.token,
            p_id: id,
            p_nombre: nombre,
            p_categoria_id: categoriaId,
            p_subcategoria_id: null,
            p_precio_venta: precio,
            p_imagen_url: productoImagenNuevaUrl,
            p_galeria: null,
            p_archivado: false
        });

        if (error || !data?.success) { alert('Error al guardar el producto'); return; }
        cerrarModalProducto();
        await cargarProductos();
    });

    document.getElementById('lista-productos').addEventListener('click', async (e) => {
        const btnEditar = e.target.closest('.btn-editar-producto');
        const btnBorrar = e.target.closest('.btn-borrar-producto');

        if (btnEditar) {
            const producto = productosCache.find(p => p.id === btnEditar.dataset.id);
            abrirModalProducto(producto);
        }
        if (btnBorrar) {
            if (!confirm('Archivar este producto? Dejara de verse en la tienda.')) return;
            const { data, error } = await sb.rpc('admin_eliminar_producto', { p_token: sesionActual.token, p_id: btnBorrar.dataset.id });
            if (error || !data?.success) { alert('Error al archivar'); return; }
            await cargarProductos();
        }
    });
}
