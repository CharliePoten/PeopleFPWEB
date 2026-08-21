/* ==========================================================================
   Conexion con el servidor
   --------------------------------------------------------------------------
   Mismo proyecto de Supabase que la app: misma base, mismos usuarios,
   mismas politicas. Quien se registre aqui entra en la app con la misma
   cuenta, y al reves.

   Estas dos claves son PUBLICAS por diseno. La `anon` no da acceso a nada
   por si misma: todo lo que se puede leer o escribir con ella lo deciden
   las politicas RLS del servidor, y por eso viaja igual dentro del paquete
   de la app. Lo que NUNCA puede aparecer aqui es la clave `service_role`.
   ========================================================================== */

window.PFP_CONFIG = {
  supabaseUrl: 'https://pvlmdqgfetwlgnhovrlv.supabase.co',
  supabaseAnonKey: 'sb_publishable_i3nU-d_5KzB7QooOpmV0dQ_H3WlrZv-',
};
