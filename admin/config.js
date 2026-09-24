// Configuración compartida del panel admin: cliente de Supabase y helpers de sesión.
const SUPABASE_URL = 'https://hchxjllelinmxtxksckg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjaHhqbGxlbGlubXh0eGtzY2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNjQyMzIsImV4cCI6MjEwNTg0MDIzMn0.2GtlHx77xfBZSwYCT6usMfFmqD3rxQxrv9O5wuv3Fbg';
const EDGE_FUNCTION_UPLOAD_URL = `${SUPABASE_URL}/functions/v1/admin-upload`;

// Se llama "sb" (no "supabase") porque el propio CDN de supabase-js ya
// declara una variable global "supabase" con la librería -- redeclararla
// como const revienta el script entero con un SyntaxError silencioso.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const Sesion = {
    KEY: 'admin_session_token',
    guardar(token) { localStorage.setItem(this.KEY, token); },
    obtener() { return localStorage.getItem(this.KEY); },
    borrar() { localStorage.removeItem(this.KEY); },
    async verificar() {
        const token = this.obtener();
        if (!token) return null;
        const { data, error } = await sb.rpc('admin_verificar_sesion', { p_token: token });
        if (error || !data?.success) { this.borrar(); return null; }
        return { token, ...data };
    },
    async requerir() {
        const sesion = await this.verificar();
        if (!sesion) { window.location.href = 'index.html'; return null; }
        return sesion;
    },
    async cerrar() {
        const token = this.obtener();
        if (token) await sb.rpc('admin_logout', { p_token: token });
        this.borrar();
        window.location.href = 'index.html';
    }
};

async function subirImagen(file, carpeta) {
    const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
    const resp = await fetch(EDGE_FUNCTION_UPLOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            token: Sesion.obtener(),
            carpeta,
            nombre_archivo: file.name,
            content_type: file.type,
            base64
        })
    });
    const data = await resp.json();
    if (!data.success) throw new Error(data.message || 'Error al subir la imagen');
    return data.url;
}
