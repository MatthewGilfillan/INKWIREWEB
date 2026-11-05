// Same-origin bootstrap for ZetaJS's office worker, avoiding a data-URL script.
import('/vendor/zetajs/zetaHelper.js').then(module=>module.zetaHelperWrapThread());
