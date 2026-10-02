(function (root) {
  'use strict';
  root.SDSO_CONFIG = Object.freeze({
    version: '0.1.2',
    cachePrefix: 'centro-control-sdso-',
    backendUrl: '',
    links: Object.freeze({
      compressors: Object.freeze({
        name: 'App Compresores',
        description: 'Aplicación operacional de Compresores vigente.',
        url: 'https://mmorenorissi.github.io/checklist-compresores/'
      }),
      turnReport: Object.freeze({
        name: 'Centro Informe Fin de Turno',
        description: 'Aplicación vigente para informe y consolidación del turno.',
        url: 'https://apps-mtto-ant.github.io/Centro-Informes-Turno/'
      })
    })
  });
})(globalThis);
