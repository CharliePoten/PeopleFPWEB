/* ==========================================================================
   Planes y datos de cobro
   --------------------------------------------------------------------------
   GENERADO desde `src/data/plans.ts` y `src/data/payment-details.ts` de la
   app. No se edita a mano.

   Los precios que hay aqui son SOLO para pintarlos. El que se cobra lo
   pone `start_subscription()` en el servidor a partir del identificador
   del plan; si el importe viajara desde el navegador, cualquiera
   contrataria el plan de 1.499 EUR por un centimo. Es la misma regla que
   en la app, y por eso los dos catalogos salen del mismo sitio.
   ========================================================================== */

window.PFP_PLANES = [
  {
    "id": "ngo_free",
    "tipos": [
      "ngo"
    ],
    "precio": 0,
    "aMedida": false,
    "nombre": {
      "es": "ONG · Gratuito",
      "de": "NGO · Kostenlos"
    },
    "detalle": {
      "es": "Para entidades con menos de 500.000 EUR de facturación anual. Sin límite de voluntarios ni de operaciones.",
      "de": "Fur Organisationen mit weniger als 500.000 EUR Jahresumsatz. Ohne Begrenzung von Freiwilligen oder Einsatzen."
    }
  },
  {
    "id": "ngo_per_volunteer",
    "tipos": [
      "ngo"
    ],
    "precio": 0,
    "aMedida": true,
    "nombre": {
      "es": "ONG · Pago por voluntario",
      "de": "NGO · Zahlung pro Freiwilligem"
    },
    "detalle": {
      "es": "A partir de 500.000 EUR de facturación. Se paga por voluntario movilizado, por resultado y no por tener la herramienta abierta.",
      "de": "Ab 500.000 EUR Umsatz. Bezahlt wird pro mobilisiertem Freiwilligen, also nach Ergebnis."
    }
  },
  {
    "id": "muni_s",
    "tipos": [
      "municipality"
    ],
    "precio": 29900,
    "aMedida": false,
    "nombre": {
      "es": "Municipio pequeño",
      "de": "Kleine Gemeinde"
    },
    "detalle": {
      "es": "Hasta 10.000 habitantes.",
      "de": "Bis 10.000 Einwohner."
    }
  },
  {
    "id": "muni_m",
    "tipos": [
      "municipality"
    ],
    "precio": 79900,
    "aMedida": false,
    "nombre": {
      "es": "Municipio mediano",
      "de": "Mittlere Gemeinde"
    },
    "detalle": {
      "es": "De 10.001 a 50.000 habitantes.",
      "de": "Von 10.001 bis 50.000 Einwohner."
    }
  },
  {
    "id": "muni_l",
    "tipos": [
      "municipality"
    ],
    "precio": 149900,
    "aMedida": false,
    "nombre": {
      "es": "Municipio grande",
      "de": "Grosse Gemeinde"
    },
    "detalle": {
      "es": "De 50.001 a 100.000 habitantes.",
      "de": "Von 50.001 bis 100.000 Einwohner."
    }
  },
  {
    "id": "muni_xl",
    "tipos": [
      "municipality"
    ],
    "precio": 0,
    "aMedida": true,
    "nombre": {
      "es": "Ciudades y diputaciones",
      "de": "Stadte und Kreise"
    },
    "detalle": {
      "es": "Más de 100.000 habitantes. El presupuesto se ajusta a cada caso.",
      "de": "Mehr als 100.000 Einwohner. Das Angebot wird angepasst."
    }
  },
  {
    "id": "company",
    "tipos": [
      "company",
      "emergency_service"
    ],
    "precio": 0,
    "aMedida": true,
    "nombre": {
      "es": "Empresa",
      "de": "Unternehmen"
    },
    "detalle": {
      "es": "Programas de responsabilidad social. El presupuesto se ajusta a cada caso.",
      "de": "Programme fur soziale Verantwortung. Das Angebot wird angepasst."
    }
  }
];

window.PFP_COBRO = {
  "titular": "People for People",
  "iban": "ES55 1583 0001 1991 0470 0435",
  "bizum": "+34 699 04 38 62",
  "correo": "peopleforpeopleofficial@gmail.com",
  "stripe": {
    "muni_s": "https://buy.stripe.com/test_4gM14mbwhfxo4MTgDDdQQ00",
    "muni_m": "https://buy.stripe.com/test_7sYbJ0fMxfxocfl2MNdQQ01",
    "muni_l": "https://buy.stripe.com/test_8x23cu9o9etk0wDcnndQQ02"
  }
};
