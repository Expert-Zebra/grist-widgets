grist.ready();

grist.onRecord((record) => {
  if (record.Price && record.Energy_Label) {
    const request = {
      "request": {
        "single": false,
        "energyLabels": [`EnergyLabel_${record.Energy_Label}`],
        "usingBroker": true
      },
      "house": {
        "buildingType": "EXISTING",
        "purchasePrice": record.Price,
        "marketValue": record.Sale_price_out_of_pocket > 0 ? record.Price - record.Sale_price_out_of_pocket : record.Price
      },
      "applicants": [
        {
          "incomes": [
            {
              "type": "EMPLOYMENT",
              "amount": 145000
            }
          ],
          "expenses": []
        }
      ],
      "mortgage": {}
    };

    return fetch(`https://api.www.ing.nl/mortgage-max-loan-calculator/calculate/orientation?data=${JSON.stringify(request)}`)
      .then((response) => response.json())
      .then((res) => {
        const response = res.maxLoans[0];

        document.getElementById("mortgage").value = response.loan.loanSections[0].monthlyFinancialBurden;
        document.getElementById("purchase-cost").value = response.ownMoneyRequired + record.Sale_price_out_of_pocket;

        return response;
      })
      .then((response) => {
        grist.selectedTable.update({
          id: record.id,
          fields:
            {
              Mortgage: response.loan.loanSections[0].monthlyFinancialBurden,
              Cash_upfront: response.ownMoneyRequired
            }
        });
      });
  }
});
