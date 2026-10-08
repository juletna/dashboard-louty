export function forecastOutlookHTML(outlook, isCA, money, escape) {
  if (!outlook) return '';
  const total = isCA ? outlook.totalCA : outlook.totalMB;
  const result = total === null ? escape(outlook.unavailable) :
    '<strong>' + money(total) + ' HT</strong> · réalisé + ' + (isCA ? 'CA à facturer (estimation)' : 'marge estimée sur le CA à facturer (estimation)');
  let calculation = 'CA réalisé (' + money(outlook.actualCA) + ') + CA à facturer estimé (' + money(outlook.futureCA) + ') = ' + money(outlook.totalCA) + ' HT.';
  if (!isCA && outlook.totalMB !== null) {
    calculation += '<br>Taux de marge pondéré ' + escape(outlook.reference) + ' : ' + (outlook.rate * 100).toLocaleString('fr-FR', {maximumFractionDigits:1}) + ' % (total des marges / total des CA).';
    calculation += '<br>Enveloppe de coûts : ' + money(outlook.totalCA) + ' × (1 − taux de marge) = ' + money(outlook.annualCosts) + '.';
    calculation += '<br>Coûts déjà comptabilisés : CA − marge réalisée = ' + money(outlook.actualCosts) + '. Coûts encore estimés : ' + money(outlook.futureCosts) + ' (minimum zéro).';
    calculation += '<br>Marge estimée totale : ' + money(outlook.actualMB) + ' + ' + money(outlook.futureCA) + ' − ' + money(outlook.futureCosts) + ' = ' + money(outlook.totalMB) + ' HT.';
    calculation += '<br>Les coûts futurs sont répartis au prorata du CA à facturer (estimation) par mois. Les achats déjà engagés sont pris en compte, sans mesure du stock disponible.';
  }
  return '<div class="forecast-outlook"><p>' + result + '</p><details><summary>Comprendre le prévisionnel</summary><p>' + calculation + '</p><p>Le montant à facturer estimé est réparti uniformément sur les mois restant après la période RES, jusqu’à décembre. Les devis en attente client ou de validation sont exclus. Cette répartition est un scénario, pas un calendrier de facturation. Ce scénario ne s’ajoute pas à la projection statistique du cap annuel.</p></details></div>';
}
