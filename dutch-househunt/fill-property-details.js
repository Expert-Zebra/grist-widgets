grist.ready();

grist.onRecord((record) => {
  if (record.URL && !record.Address) {
    record.tinyId = /\/(\d{7,9})(\/|\?|$)/.exec(record.URL.toString())[1];
  }

  if (record.tinyId) {
    return fetchRecordDetails(record).then(([record, response]) => {
      document.getElementById("api-response").value = JSON.stringify(response);
      document.getElementById('update-property-with-funda')
        .addEventListener("click", () => fullyUpdateRecord([record, response]));

      if (!record.Address) {
        return fullyUpdateRecord([record, response]);
      }
    });
  }
});

grist.onRecords((records) => {
  document.getElementById("update-all-properties-sold-status").addEventListener("click", () =>
    fetchAllLightweight(records).then(responses => responses.forEach(([{id}, {isSoldOrRented}]) =>
      grist.selectedTable.update({id, fields: {Sold: isSoldOrRented}})))
  )
});

function fetchRecord(record, fetchType) {
  let targetUrl;
  if (fetchType === "tinyId") {
    targetUrl = `https://listing-detail-page.funda.io/api/v4/listing/object/nl/tinyId/${record.tinyId}`
  } else if (fetchType === "globalId") {
    targetUrl = `https://listing-detail-summary.funda.io/api/v1/listing/nl/${record.globalId}`
  } else {
    throw Error("Fetch type not declared");
  }

  return fetch(targetUrl)
    .then((response) => response.json())
    .then((response) => [record, response])
}

function fetchRecordDetails(record) {
  return fetchRecord(record, 'tinyId')
    .catch((e) => {
      if (!record.tinyId) {
        console.error("Record is missing tinyId");
      }
    });
}

function fetchRecordLightWeight(record) {
  return fetchRecord(record, 'globalId');
}

function fetchAllLightweight(records) {
  return Promise.all(records.map(fetchRecordLightWeight));
}

function fetchAll(records) {
  return Promise.all(records.map(fetchRecordDetails));
}

function fullyUpdateRecord([record, response]) {
  const boolTrueString = new RegExp("true", "i");
  const energy = response.KenmerkSections.find(({Id}) => Id === "energie").KenmerkenList.find(({Id}) => Id === "energie-energielabel").EnergyLabel;
  const parcel = response.KenmerkSections.find(({Id}) => Id === "cadastral").KenmerkenList.find(({Id}) => Id === "cadastral-parcel").KenmerkenList;
  const layout = response.KenmerkSections.find(({Id}) => Id === "indeling").KenmerkenList;
  const lift = (layout?.find(({Id}) => Id === "indeling-generalfacilities")?.Value ?? "").toLowerCase();
  const Service = calculateServiceCost(response.KenmerkSections);
  const [Lease_info, Lease_paid_through] = calculateLeaseInfo(parcel);

  return grist.selectedTable.update({
    id: record.id, fields: {
      Address: response.AddressDetails.Title,
      BR: response.FastView.NumberOfBedrooms,
      Balcony: boolTrueString.test(response.Advertising.TargetingOptions.balkon),
      Energy_Label: energy.length === 1 ? energy : `A${"+".repeat(energy[1])}`,
      Floor: parseInt(layout?.find(({Id}) => Id === "indeling-locatedat")?.Value.replace("e woonlaag", "")) || 0,
      globalId: response.Identifiers.GlobalId,
      Lat: response.Coordinates.Latitude,
      Long: response.Coordinates.Longitude,
      Lease_paid_through,
      Lease_info,
      Garden: boolTrueString.test(response.Advertising.TargetingOptions.tuin),
      Lift: lift.includes("lift") || lift.includes("elevator"),
      Neighbourhood: response.AddressDetails.City === "Zandvoort" ?
        `Zandvoort ${response.AddressDetails.NeighborhoodName}` :
        response.AddressDetails.NeighborhoodName,
      Price: response.Price.NumericSellingPrice / 1000,
      Service,
      Sold: response.isSoldOrRented,
      Stories: parseInt(layout.find(({Id}) => Id === "indeling-totalstories").Value.replace(" woonlaag", "")),
      tinyId: response.Identifiers.TinyId,
      Terrace: boolTrueString.test(response.Advertising.TargetingOptions.dakterras),
      m2: parseInt(response.Advertising.TargetingOptions.woonoppervlakte)
    }
  });
}

function calculateServiceCost(r) {
  const overview = r.find(({Id}) => Id === "overdracht").KenmerkenList;

  const bijdragvve = overview.find(({Id}) => Id === "overdracht-bijdragevve")?.Value;
  const serviceCost = overview.find(({Label}) => Label === "Servicekosten")?.Value;
  const vveChecklist = r.find(({Id}) => Id === "vvechecklist")?.KenmerkenList.find(({Value}) => Value.includes("€"))?.Value;

  if (/€ /.test(bijdragvve)) return convertMoney(bijdragvve);
  if (/€ /.test(serviceCost)) return convertMoney(serviceCost);
  if (vveChecklist) return convertMoney(vveChecklist);

  return 0;
}

function convertMoney(str) {
  const matches = /€ (\d{1,3})(,\d{2})?/.exec(str);

  if (matches) return parseInt(`${matches[1]}${matches[2]?.replace(",", "") ?? "00"}`) / 100;

  return 0;
}

function calculateLeaseInfo(parcel) {
  const ownershipSituation = parcel.find(({Id}) => Id === "cadastral-ownershipsituation").Value;
  const datestring = new RegExp("(\\d{2})-(\\d{2})-(\\d{4})");
  const leaseholdFees = parcel.find(({Id}) => Id === "cadastral-fees")?.Value;
  const leaseInfo = [];

  let leaseDate = "";

  if (/^€/.test(leaseholdFees)) {
    leaseInfo.push(leaseholdFees.replace("per jaar met optie tot afkopen", "per year with buyout option"));
  }

  if (datestring.test(leaseholdFees)) {
    const date = leaseholdFees.match(datestring);

    leaseDate = `${date[3]}-${date[2]}-${date[1]}`;

    if (/^Afgekocht/.test(leaseholdFees)) {
      leaseInfo.push("Paid through date specified");
    }
  } else if (datestring.test(ownershipSituation)) {
    const date = ownershipSituation.match(datestring);

    leaseDate = `${date[3]}-${date[2]}-${date[1]}`;
  }

  if (/Eeuwigdurend afgekocht/.test(leaseholdFees)) {
    leaseInfo.push("Paid off for eternity");
  }

  if (ownershipSituation === "Volle eigendom") {
    leaseInfo.push("Full ownership");
  }

  if (/Gemeentelijk.+erfpacht/.test(ownershipSituation)) {
    leaseInfo.push("Municipal leasehold");
  } else if (/Eigendom belast met erfpacht/.test(ownershipSituation)) {
    leaseInfo.push("Subject to leasehold");
  }

  return [leaseInfo.join("; "), leaseDate];
}

