export function forecastOutlookHTML(outlook, isCA, money, escape) {
  if (!outlook) return '';
  const total = isCA ? outlook.totalCA : outlook.totalMB;
  const result = total === null ? escape(outlook.unavailable) :
    '<strong>' + money(total) + ' HT</strong> · réalisé + ' + (isCA ? 'CA confirmé' : 'marge estimée sur le confirmé');
  let calculation = 'CA réalisé (' + money(outlook.actualCA) + ') + confirmé restant (' + money(outlook.futureCA) + ') = ' + money(outlook.totalCA) + ' HT.';
  if (!isCA && outlook.totalMB !== null) {
    calculation += '<br>Taux de marge pondéré ' + escape(outlook.reference) + ' : ' + (outlook.rate * 100).toLocaleString('fr-FR', {maximumFractionDigits:1}) + ' % (total des marges / total des CA).';
    calculation += '<br>Enveloppe de coûts : ' + money(outlook.totalCA) + ' × (1 − taux de marge) = ' + money(outlook.annualCosts) + '.';
    calculation += '<br>Coûts déjà comptabilisés : CA − marge réalisée = ' + money(outlook.actualCosts) + '. Coûts encore estimés : ' + money(outlook.futureCosts) + ' (minimum zéro).';
    calculation += '<br>Marge estimée totale : ' + money(outlook.actualMB) + ' + ' + money(outlook.futureCA) + ' − ' + money(outlook.futureCosts) + ' = ' + money(outlook.totalMB) + ' HT.';
    calculation += '<br>Les coûts futurs sont répartis au prorata du CA confirmé par mois. Les achats déjà engagés sont pris en compte, sans mesure du stock disponible.';
  }
  return '<div class="forecast-outlook"><p>' + result + '</p><details><summary>Comprendre le prévisionnel</summary><p>' + calculation + '</p><p>Chantiers confirmés, datés après la période importée et dans l’exercice. En attente et sans date exclus. Ce scénario ne s’ajoute pas à la projection statistique du cap annuel.</p></details></div>';
}
