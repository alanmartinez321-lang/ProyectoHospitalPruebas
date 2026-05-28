// js/views/medico.view.js
// ============================================================
// MÓDULO 5 - Historial Clínico y Consultas (Flujo del Médico)
// HU20: Visualizar agenda de citas
// HU21: Registrar consulta médica
// HU22: Consultar historial clínico de un paciente
// HU23: Agregar entradas al historial (append, no editar)
// HU24: Paciente consulta su historial (renderizado en paciente.html)
// ============================================================
// ARCHIVOS QUE USA ESTE MÓDULO:
//   - js/modules/historial.js  → lógica de negocio del historial (NO MODIFICAR)
//   - js/core/db.js            → motor de datos (NO MODIFICAR)
//   - js/core/auth.js          → guardián de sesión (NO MODIFICAR)
//   - js/core/utils.js         → formatearFecha (NO MODIFICAR)
//   - medico.html              → HTML con los modales y tablas (NO MODIFICAR)
// ============================================================
 
import Auth from '../core/auth.js';
import DB from '../core/db.js';
import HistorialModulo from '../modules/historial.js';
import { formatearFecha } from '../core/utils.js';
 
// ─────────────────────────────────────────
// 0. GUARDIA DE SEGURIDAD
//    Redirige si no es médico logueado
// ─────────────────────────────────────────
Auth.checkGuard();
 
// ─────────────────────────────────────────
// 1. DATOS DE SESIÓN
//    Leemos quién está logueado
// ─────────────────────────────────────────
const sesion = JSON.parse(sessionStorage.getItem('hospital_sesion'));
 
// Buscamos el perfil profesional del médico usando su usuarioId
const perfilMedico = DB.state.medicos.find(m => m.usuarioId === sesion.id);
 
// ─────────────────────────────────────────
// 2. PINTAR NOMBRE Y ESPECIALIDAD EN HEADER
// ─────────────────────────────────────────
document.getElementById('medico-name').textContent = sesion.nombre || 'Dr. Profesional';
 
if (perfilMedico) {
    const especialidad = DB.state.especialidades.find(e => e.id === perfilMedico.especialidadId);
    document.getElementById('medico-esp').textContent = especialidad ? especialidad.nombre : 'Sin especialidad';
}
 
// ─────────────────────────────────────────
// 3. NAVEGACIÓN ENTRE SECCIONES (sidebar)
// ─────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.dataset.section;
 
        // Ocultar todas las secciones
        document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
        // Mostrar la seleccionada
        document.getElementById(targetId)?.classList.remove('hidden');
 
        // Actualizar nav activo
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        link.classList.add('active');
 
        // Actualizar título del header
        document.getElementById('section-title').textContent = link.textContent.trim();
 
        // Renderizar contenido según sección
        if (targetId === 'sec-agenda') renderAgenda();
        if (targetId === 'sec-pacientes-med') renderListaPacientes();
        if (targetId === 'sec-perfil-med') renderPerfilMedico();
    });
});
 
// ─────────────────────────────────────────
// 4. CERRAR SESIÓN
// ─────────────────────────────────────────
document.getElementById('btn-logout').addEventListener('click', () => Auth.logout());
 
// ─────────────────────────────────────────
// 5. HU20 - RENDERIZAR AGENDA DEL MÉDICO
//    Muestra las citas asignadas al médico logueado
// ─────────────────────────────────────────
function renderAgenda() {
    const tbody = document.getElementById('table-agenda-body');
    if (!tbody) return;
 
    // Si no encontramos el perfil del médico, mostramos error
    if (!perfilMedico) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#dc2626;">
            No se encontró perfil médico asociado a esta cuenta.
        </td></tr>`;
        return;
    }
 
    // Filtramos las citas que corresponden a este médico
    const citasDelMedico = DB.state.citas.filter(c => c.medicoId === perfilMedico.id);
 
    if (citasDelMedico.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#64748b;padding:2rem;">
            No tienes citas programadas.
        </td></tr>`;
        return;
    }
 
    // Ordenamos por fecha más próxima primero
    const citasOrdenadas = [...citasDelMedico].sort((a, b) => {
        return new Date(`${a.fecha}T${a.hora}`) - new Date(`${b.fecha}T${b.hora}`);
    });
 
    tbody.innerHTML = citasOrdenadas.map(cita => {
        // Buscamos el nombre del paciente
        const paciente = DB.state.pacientes.find(p => p.id === cita.pacienteId);
        const nombrePaciente = paciente ? paciente.nombre : 'Paciente no encontrado';
 
        // Badge de color según estado
        const badgeColor = {
            'confirmada': 'badge-success',
            'cancelada':  'badge-danger',
            'atendida':   'badge-warning',
        }[cita.estado] || 'badge-success';
 
        // Botón "Atender" solo si la cita está confirmada
        const btnAtender = cita.estado === 'confirmada'
            ? `<button class="btn-primary btn-small btn-atender"
                    data-cita-id="${cita.id}"
                    data-paciente-id="${cita.pacienteId}"
                    data-paciente-nombre="${nombrePaciente}">
                    Atender / Registrar
               </button>`
            : `<span style="color:#94a3b8;font-size:0.8rem;">${cita.estado}</span>`;
 
        return `
            <tr>
                <td>${cita.fecha}</td>
                <td>${cita.hora}</td>
                <td>${nombrePaciente}</td>
                <td>${cita.motivo || '—'}</td>
                <td><span class="badge ${badgeColor}">${cita.estado}</span></td>
                <td>${btnAtender}</td>
            </tr>
        `;
    }).join('');
 
    // Adjuntamos listeners a los botones de atender
    // (No usamos innerHTML con eventos inline para no perder listeners — Regla del equipo)
    tbody.querySelectorAll('.btn-atender').forEach(btn => {
        btn.addEventListener('click', () => {
            abrirModalAtencion(btn.dataset.citaId, btn.dataset.pacienteId, btn.dataset.pacienteNombre);
        });
    });
}
 
// ─────────────────────────────────────────
// 6. HU21 - MODAL REGISTRAR CONSULTA
//    Abre el modal para documentar una atención
// ─────────────────────────────────────────
let _citaActiva    = null;  // Guardamos la cita que se está atendiendo
let _pacienteActivo = null;  // Guardamos el paciente que se está atendiendo
 
function abrirModalAtencion(citaId, pacienteId, nombrePaciente) {
    _citaActiva     = citaId;
    _pacienteActivo = pacienteId;
 
    // Pintamos el nombre en el título del modal
    document.getElementById('at-paciente-nombre').textContent = nombrePaciente;
 
    // Limpiamos campos anteriores
    document.getElementById('at-tipo').value    = 'Consulta';
    document.getElementById('at-resumen').value  = '';
    document.getElementById('at-detalle').value  = '';
 
    document.getElementById('modal-atencion').classList.remove('hidden');
}
 
// Cerrar modal de atención
document.getElementById('btn-close-atencion').addEventListener('click', () => {
    document.getElementById('modal-atencion').classList.add('hidden');
});
 
// ─────────────────────────────────────────
// 7. HU21 + HU23 - GUARDAR EN HISTORIAL
//    Llama a HistorialModulo.agregarRegistro()
//    Cada guardado es un APPEND (nuevo registro), nunca un UPDATE
// ─────────────────────────────────────────
document.getElementById('btn-save-atencion').addEventListener('click', () => {
    const tipo    = document.getElementById('at-tipo').value.trim();
    const titulo  = document.getElementById('at-resumen').value.trim();
    const detalle = document.getElementById('at-detalle').value.trim();
 
    // Validación básica
    if (!titulo || !detalle) {
        mostrarAlerta('modal-atencion', 'El título y el detalle clínico son obligatorios.', 'error');
        return;
    }
 
    try {
        // HU21: Registramos la consulta. HistorialModulo valida que sea médico.
        // HU23: agregarRegistro() siempre hace DB.add() → es un APPEND, nunca modifica registros anteriores.
        HistorialModulo.agregarRegistro(_pacienteActivo, {
            tipo:    tipo,
            titulo:  titulo,
            detalle: detalle,
            citaId:  _citaActiva  // Esto marca la cita como 'atendida' automáticamente
        });
 
        document.getElementById('modal-atencion').classList.add('hidden');
 
        // Recargamos la agenda para que el estado de la cita se actualice visualmente
        renderAgenda();
 
        mostrarToast('✅ Registro guardado en el historial del paciente.');
    } catch (error) {
        mostrarAlerta('modal-atencion', error.message, 'error');
    }
});
 
// ─────────────────────────────────────────
// 8. HU22 - LISTA DE PACIENTES CON EXPEDIENTES
//    El médico busca pacientes y accede a su historial
// ─────────────────────────────────────────
function renderListaPacientes(filtro = '') {
    const tbody = document.getElementById('table-pacientes-list-body');
    if (!tbody) return;
 
    // Obtenemos pacientes que tienen al menos una cita con este médico
    // o mostramos todos si no hay filtro (decisión de diseño: acceso completo para el médico)
    let pacientes = DB.state.pacientes.filter(p => p.activo);
 
    // Si hay búsqueda, filtramos por nombre
    if (filtro.trim()) {
        const q = filtro.toLowerCase();
        pacientes = pacientes.filter(p => p.nombre.toLowerCase().includes(q));
    }
 
    if (pacientes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#64748b;padding:2rem;">
            No se encontraron pacientes.
        </td></tr>`;
        return;
    }
 
    tbody.innerHTML = pacientes.map(p => `
        <tr>
            <td>${p.nombre}</td>
            <td>${p.edad || '—'}</td>
            <td>${p.genero || '—'}</td>
            <td>
                <button class="btn-primary btn-small btn-ver-historial"
                    data-paciente-id="${p.id}"
                    data-paciente-nombre="${p.nombre}">
                    Ver Historial
                </button>
                <button class="btn-success btn-small btn-nueva-entrada" style="margin-left:5px;"
                    data-paciente-id="${p.id}"
                    data-paciente-nombre="${p.nombre}">
                    + Agregar Entrada
                </button>
            </td>
        </tr>
    `).join('');
 
    // Listeners: ver historial
    tbody.querySelectorAll('.btn-ver-historial').forEach(btn => {
        btn.addEventListener('click', () => {
            abrirModalVerHistorial(btn.dataset.pacienteId, btn.dataset.pacienteNombre);
        });
    });
 
    // Listeners: nueva entrada al historial (sin cita asociada)
    tbody.querySelectorAll('.btn-nueva-entrada').forEach(btn => {
        btn.addEventListener('click', () => {
            // Abrimos el modal de atención pero sin citaId (entrada libre)
            abrirModalAtencion(null, btn.dataset.pacienteId, btn.dataset.pacienteNombre);
        });
    });
}
 
// Búsqueda en tiempo real
document.getElementById('search-paciente')?.addEventListener('input', (e) => {
    renderListaPacientes(e.target.value);
});
 
// ─────────────────────────────────────────
// 9. HU22 - MODAL VER HISTORIAL COMPLETO
//    Muestra todas las entradas del expediente del paciente
// ─────────────────────────────────────────
function abrirModalVerHistorial(pacienteId, nombrePaciente) {
    document.getElementById('hist-paciente-nombre').textContent = nombrePaciente;
 
    const container = document.getElementById('historial-container');
 
    // HU22: Obtenemos el historial usando HistorialModulo
    const registros = HistorialModulo.obtenerHistorialPaciente(pacienteId);
 
    if (registros.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:2rem;color:#64748b;">
                <p>📋 Este paciente aún no tiene registros clínicos.</p>
            </div>
        `;
    } else {
        // Renderizamos como timeline (cada entrada es un nuevo registro)
        container.innerHTML = registros.map(r => {
            // Buscamos quién registró la entrada
            const medicoRegistro = DB.state.medicos.find(m => m.id === r.medicoId);
            const usuarioMedico  = medicoRegistro
                ? DB.state.usuarios.find(u => u.id === medicoRegistro.usuarioId)
                : null;
            const nombreMedico = usuarioMedico ? usuarioMedico.nombre : 'Médico desconocido';
 
            // Badge de color por tipo de registro
            const colorTipo = {
                'Consulta':    '#2563eb',
                'Diagnóstico': '#7c3aed',
                'Tratamiento': '#059669',
                'Receta':      '#d97706',
            }[r.tipo] || '#64748b';
 
            return `
                <div style="border-left: 3px solid ${colorTipo}; padding: 1rem 1.5rem; margin-bottom: 1rem;
                            background: #f8fafc; border-radius: 0 8px 8px 0;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                        <span style="background:${colorTipo}; color:white; padding:2px 10px;
                                     border-radius:12px; font-size:0.75rem; font-weight:600;">
                            ${r.tipo}
                        </span>
                        <small style="color:#94a3b8;">${formatearFecha(r.fecha)}</small>
                    </div>
                    <strong style="font-size:1rem; color:#1e293b;">${r.titulo}</strong>
                    <p style="margin:0.5rem 0 0.5rem 0; color:#475569; font-size:0.9rem;">${r.detalle}</p>
                    <small style="color:#94a3b8;">👨‍⚕️ Registrado por: ${nombreMedico}</small>
                </div>
            `;
        }).join('');
    }
 
    document.getElementById('modal-ver-historial').classList.remove('hidden');
}
 
// Cerrar modal de historial
document.getElementById('btn-close-historial').addEventListener('click', () => {
    document.getElementById('modal-ver-historial').classList.add('hidden');
});
 
// ─────────────────────────────────────────
// 10. PERFIL DEL MÉDICO (Solo lectura)
//     Muestra los datos del médico logueado
// ─────────────────────────────────────────
function renderPerfilMedico() {
    if (!perfilMedico) return;
 
    const usuario     = DB.state.usuarios.find(u => u.id === perfilMedico.usuarioId);
    const especialidad = DB.state.especialidades.find(e => e.id === perfilMedico.especialidadId);
 
    document.getElementById('m-pf-nombre').value  = usuario?.nombre || '';
    document.getElementById('m-pf-cedula').value  = perfilMedico.cedula || '';
    document.getElementById('m-pf-esp').value     = especialidad?.nombre || '';
    document.getElementById('m-pf-email').value   = perfilMedico.email || '';
}
 
document.getElementById('btn-save-pf-med')?.addEventListener('click', () => {
    // Solo actualizamos el email de contacto (campo editable del perfil)
    const nuevoEmail = document.getElementById('m-pf-email').value.trim();
 
    if (!nuevoEmail || !nuevoEmail.includes('@')) {
        mostrarToast('⚠️ Ingresa un correo válido.', 'error');
        return;
    }
 
    if (perfilMedico) {
        DB.update('medicos', perfilMedico.id, { email: nuevoEmail });
        DB.update('usuarios', perfilMedico.usuarioId, { email: nuevoEmail });
        DB.registrarLog('Perfil Médico', `El médico ${sesion.nombre} actualizó su email de contacto.`);
        mostrarToast('✅ Contacto actualizado correctamente.');
    }
});
 
// ─────────────────────────────────────────
// 11. UTILIDADES DE UI
//     Notificaciones sin romper el DOM principal
// ─────────────────────────────────────────
 
/**
 * Muestra un toast flotante temporal
 */
function mostrarToast(mensaje, tipo = 'success') {
    // Reutilizamos o creamos el toast
    let toast = document.getElementById('toast-global');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-global';
        toast.style.cssText = `
            position: fixed; bottom: 2rem; right: 2rem;
            padding: 1rem 1.5rem; border-radius: 8px;
            font-weight: 500; font-size: 0.95rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999; transition: opacity 0.3s;
        `;
        document.body.appendChild(toast);
    }
 
    toast.textContent = mensaje;
    toast.style.background = tipo === 'error' ? '#fee2e2' : '#dcfce7';
    toast.style.color       = tipo === 'error' ? '#dc2626' : '#16a34a';
    toast.style.opacity     = '1';
 
    setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}
 
/**
 * Muestra un mensaje de error dentro de un modal
 */
function mostrarAlerta(modalId, mensaje, tipo = 'error') {
    // Buscamos o creamos el elemento de alerta dentro del modal
    const modal = document.getElementById(modalId);
    if (!modal) return;
 
    let alerta = modal.querySelector('.alerta-interna');
    if (!alerta) {
        alerta = document.createElement('div');
        alerta.className = 'alerta-interna alert';
        // Insertamos antes de los botones de acción
        const acciones = modal.querySelector('.modal-actions');
        modal.querySelector('.modal-content')?.insertBefore(alerta, acciones);
    }
 
    alerta.textContent = mensaje;
    alerta.className   = `alerta-interna alert alert-${tipo}`;
    alerta.classList.remove('hidden');
 
    // Auto-ocultar después de 4 segundos
    setTimeout(() => alerta.classList.add('hidden'), 4000);
}
 
// ─────────────────────────────────────────
// 12. INICIALIZACIÓN
//     Cargamos la sección por defecto: Agenda
// ─────────────────────────────────────────
renderAgenda();
    desbloquearCuenta(usuarioId, email) {
        if (!usuarioId) throw new Error("ID de usuario no proporcionado.");
        
        const success = DB.update('usuarios', usuarioId, { 
            bloqueado: false, 
            intentosFallidos: 0 
        });

        if (success) {
            DB.registrarLog('Cuenta Desbloqueada', `El administrador desbloqueó al médico ${email}`);
        } else {
            throw new Error("No se pudo desbloquear la cuenta. Usuario no encontrado.");
        }
    }
};

export default MedicosModulo;
