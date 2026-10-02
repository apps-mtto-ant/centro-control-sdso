// v0.1.1: el rol del frontend solo controlará presentación futura.
// La autorización real deberá validarse siempre en el backend (Apps Script).
export const auth = Object.freeze({
  enabled: false,
  role: 'LECTOR',
  user: null
});
