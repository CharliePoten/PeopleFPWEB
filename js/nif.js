/* ==========================================================================
   Validacion de NIF, NIE y CIF espanoles
   --------------------------------------------------------------------------
   Misma logica que `src/lib/tax-id.ts` de la app, y por el mismo motivo: la
   verificacion de entidades la hace una persona a mano, asi que un digito
   mal tecleado se convierte en una ida y vuelta con la entidad y en dias de
   retraso para quien esperaba poder publicar.

   Los tres formatos llevan digito de control, asi que se comprueba de
   verdad y no solo por su pinta.

   Se porta y no se importa porque la app es TypeScript con modulos y esto
   es un guion suelto en el navegador. Lo que garantiza que no se separen no
   es el codigo compartido, es la bateria de casos con la que se prueban las
   dos: los mismos CIF reales en las dos plataformas.
   ========================================================================== */

(function () {
  'use strict';

  var LETRAS_NIF = 'TRWAGMYFPDXBNJZSQVHLCKE';
  var LETRAS_CIF = 'JABCDEFGHI';

  /** Primeras letras validas de un CIF. Ni I, ni O, ni T, ni N con virgulilla. */
  var INICIALES_CIF = 'ABCDEFGHJKLMNPQRSUVW';

  var CIF_CONTROL_LETRA = 'PQRSNW';
  var CIF_CONTROL_DIGITO = 'ABEH';

  /**
   * Mayusculas y sin separadores.
   *
   * Los guiones y los espacios se quitan en vez de rechazarse. `B-12345674`
   * y `B 12345674` son el mismo CIF que `B12345674`, y hacer que alguien lo
   * vuelva a teclear sin el guion no aporta nada.
   */
  function normalizar(valor) {
    return String(valor || '').replace(/[\s./-]/g, '').toUpperCase();
  }

  function esNif(id) {
    if (!/^\d{8}[A-Z]$/.test(id)) return false;
    return id.charAt(8) === LETRAS_NIF.charAt(Number(id.slice(0, 8)) % 23);
  }

  function esNie(id) {
    if (!/^[XYZ]\d{7}[A-Z]$/.test(id)) return false;
    // La inicial vale por un digito: X=0, Y=1, Z=2. A partir de ahi, igual
    // que un NIF.
    var numero = Number(String('XYZ'.indexOf(id.charAt(0))) + id.slice(1, 8));
    return id.charAt(8) === LETRAS_NIF.charAt(numero % 23);
  }

  function esCif(id) {
    if (!/^[A-Z]\d{7}[\dA-Z]$/.test(id)) return false;

    var inicial = id.charAt(0);
    if (INICIALES_CIF.indexOf(inicial) === -1) return false;

    var digitos = id.slice(1, 8);
    var control = id.charAt(8);
    var suma = 0;

    for (var i = 0; i < 7; i++) {
      var n = Number(digitos.charAt(i));
      if (i % 2 === 0) {
        // Posiciones impares (1.a, 3.a...): se doblan y se suman sus cifras.
        var doble = n * 2;
        suma += doble > 9 ? doble - 9 : doble;
      } else {
        suma += n;
      }
    }

    var digitoControl = (10 - (suma % 10)) % 10;
    var letraControl = LETRAS_CIF.charAt(digitoControl);

    if (CIF_CONTROL_LETRA.indexOf(inicial) !== -1) return control === letraControl;
    if (CIF_CONTROL_DIGITO.indexOf(inicial) !== -1) return control === String(digitoControl);

    // El resto admite las dos formas.
    return control === letraControl || control === String(digitoControl);
  }

  /** Se le pasa el valor tal cual lo escribio la persona. */
  function valido(valor) {
    var id = normalizar(valor);
    if (id.length !== 9) return false;
    return esNif(id) || esNie(id) || esCif(id);
  }

  window.PFP_NIF = { normalizar: normalizar, valido: valido };
})();
