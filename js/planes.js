/* ==========================================================================
   Tramos, precios y enlaces de pago
   --------------------------------------------------------------------------
   GENERADO desde `src/data/plans.ts` y `src/data/payment-details.ts` de la
   app. No se edita a mano.

   Aqui NO se elige plan. El tamano se declara al dar de alta, alguien del
   equipo lo confirma al verificar, y la tarifa sale sola del tipo y del
   tramo. Los precios de este fichero son para pintarlos: el que se cobra lo
   calcula `start_subscription()` en el servidor.

   Solo mensual, sin permanencia y sin tarifa gratuita. Lo unico libre son
   las dos primeras publicaciones.
   ========================================================================== */

window.PFP_TAMANOS = {
  "ngo": {
    "pregunta": "c.pl.askVolunteers",
    "bandas": [
      {
        "size": "small",
        "upTo": 50,
        "cents": 1900
      },
      {
        "size": "medium",
        "upTo": 250,
        "cents": 4900
      },
      {
        "size": "large",
        "upTo": null,
        "cents": 9900
      }
    ]
  },
  "municipality": {
    "pregunta": "c.pl.askPopulation",
    "bandas": [
      {
        "size": "small",
        "upTo": 10000,
        "cents": 4900
      },
      {
        "size": "medium",
        "upTo": 50000,
        "cents": 9900
      },
      {
        "size": "large",
        "upTo": null,
        "cents": 19900
      }
    ]
  },
  "company": {
    "pregunta": "c.pl.askEmployees",
    "bandas": [
      {
        "size": "small",
        "upTo": 50,
        "cents": 1900
      },
      {
        "size": "medium",
        "upTo": 250,
        "cents": 4900
      },
      {
        "size": "large",
        "upTo": null,
        "cents": 9900
      }
    ]
  },
  "emergency_service": {
    "pregunta": "c.pl.askEmployees",
    "bandas": [
      {
        "size": "small",
        "upTo": 50,
        "cents": 1900
      },
      {
        "size": "medium",
        "upTo": 250,
        "cents": 4900
      },
      {
        "size": "large",
        "upTo": null,
        "cents": 9900
      }
    ]
  }
};

window.PFP_COBRO = {
  "titular": "People for People",
  "iban": "ES55 1583 0001 1991 0470 0435",
  "correo": "peopleforpeopleofficial@gmail.com",
  "stripe": {
    "ngo_small": "https://buy.stripe.com/test_8x2aEW57TfxodjpevvdQQ0c",
    "ngo_medium": "https://buy.stripe.com/test_9B65kCdEp1GybbhdrrdQQ0b",
    "ngo_large": "https://buy.stripe.com/test_7sY6oGbwhetkdjp733dQQ09",
    "municipality_small": "https://buy.stripe.com/test_8x27sK6bX4SK5QX9bbdQQ0a",
    "municipality_medium": "https://buy.stripe.com/test_4gMbJ0asdgBscfl1IJdQQ08",
    "municipality_large": "https://buy.stripe.com/test_aFa6oGgQBetkentgDDdQQ06",
    "company_small": "https://buy.stripe.com/test_7sYeVcdEp5WO1AHdrrdQQ05",
    "company_medium": "https://buy.stripe.com/test_9B6eVceIt0Cufrx877dQQ04",
    "company_large": "https://buy.stripe.com/test_4gMbJ0cAldpg2EL5YZdQQ03",
    "emergency_service_small": "https://buy.stripe.com/test_7sYeVcdEp5WO1AHdrrdQQ05",
    "emergency_service_medium": "https://buy.stripe.com/test_9B6eVceIt0Cufrx877dQQ04",
    "emergency_service_large": "https://buy.stripe.com/test_4gMbJ0cAldpg2EL5YZdQQ03"
  }
};

/** De un numero al tramo. Espejo de `size_tier_for()` en el servidor. */
window.PFP_TRAMO = function (tipo, numero) {
  var bandas = (window.PFP_TAMANOS[tipo] || window.PFP_TAMANOS.ngo).bandas;
  for (var i = 0; i < bandas.length; i++) {
    if (bandas[i].upTo === null || numero <= bandas[i].upTo) return bandas[i].size;
  }
  return 'large';
};

/** Precio mensual en centimos de un tramo. */
window.PFP_PRECIO = function (tipo, tramo) {
  var bandas = (window.PFP_TAMANOS[tipo] || window.PFP_TAMANOS.ngo).bandas;
  for (var i = 0; i < bandas.length; i++) if (bandas[i].size === tramo) return bandas[i].cents;
  return null;
};
