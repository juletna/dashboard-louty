export function forecastOutlookHTML(outlook, isCA, money, escape) {
  if (!outlook) return '';
  const total = isCA ? outlook.totalCA : outlook.totalMB;
  const result = total === null ? escape(outlook.unavailable) :
    '<strong>' + money(total) + ' HT</strong> · réalisé + ' + (isCA ? 'CA à facturer (estimation)' : 'marge estimée sur le CA à facturer (estimation)');
  let calculation = 'CA réalisé (' + money(outlook.actualCA) + ') + CA à facturer estimé (' + money(outlook.futureCA) + ') = ' + money(outlook.totalCA) + ' HT.';
  if (!isCA && outlook.totalMB !== null) {
    calculation += '<br>Taux de marge pondéré ' + escape(outlook.reference) + ' : ' + (outlook.rate * 100).toLocaleString('fr-FR', {maximumFractionDigits:1}) + ' % (total des marges / total des CA).';
    calculation += '<br>Marge brute projetée : ' + money(outlook.actualMB) + ' + ' + money(outlook.futureCA) + ' × ' + (outlook.rate * 100).toLocaleString('fr-FR', {maximumFractionDigits:1}) + ' % = ' + money(outlook.totalMB) + ' HT.';
    calculation += '<br>Le taux historique s’applique uniquement au CA restant à facturer. La marge déjà réalisée est conservée. Les coûts futurs estimés correspondent au complément de ce taux, sans ajustement pour les achats déjà engagés.';
  }
  return '<div class="forecast-outlook"><p>' + result + '</p><details><summary>Comprendre le prévisionnel</summary><p>' + calculation + '</p><p>Le montant à facturer estimé est réparti uniformément sur les mois restant après la période RES, jusqu’à décembre. Les devis en attente client ou de validation sont exclus. Cette répartition est un scénario, pas un calendrier de facturation. Ce calcul alimente aussi les projections du cap annuel.</p></details></div>';
}
