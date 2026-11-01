export const SRS_FORMS = Object.freeze([
 {title:'Formulario de registro sanitario de productos farmacéuticos',url:'https://www.srs.gob.sv/?wpdmpro=formulario-para-registro-sanitario-de-productos-farmaceuticos'},
 {title:'Guía de requisitos para registro sanitario de productos farmacéuticos',url:'https://www.srs.gob.sv/?wpdmpro=guia-requisitos-para-registro-sanitario-de-productos-farmaceuticos'},
 {title:'Modificaciones posteriores al registro',url:'https://www.srs.gob.sv/?wpdmpro=formulario-para-tramites-de-modificaciones-posteriores-al-registro-de-productos-farmaceuticos'},
 {title:'Constancias y certificaciones de registro sanitario',url:'https://www.srs.gob.sv/?wpdmpro=formulario-para-solicitar-constancias-y-certificaciones-de-registro-sanitario'},
 {title:'Medicamentos biológicos y biotecnológicos',url:'https://www.srs.gob.sv/?wpdmpro=guia-para-el-registro-de-medicamentos-biologicos-y-biotecnologicos'}
]);
export const SRS_CONTEXT = 'Para trámites farmacéuticos en El Salvador, proporciona los enlaces oficiales de la SRS pertinentes al producto. Distingue registro de producto de habilitación de establecimiento. No declares que un expediente fue presentado, aprobado o autorizado. Recomienda verificar vigencia y revisión por responsable técnico. Formularios: '+SRS_FORMS.map(f=>f.title+': '+f.url).join('; ');
