// Popolnoma prevedi ta imenski prostor (slovenščina + angleščina).
// E2-2 inventarni runtime: gibi zaloge (LEDGER) + widget seštevka.
export const inventorySl = {
  // Kartica gibov zaloge (na izdelku)
  movementsTitle: "Gibi zaloge",
  movementsDesc:
    "Prihod in odhod blaga — vsak gib se zapiše v evidenco in takoj posodobi stanje zaloge.",
  currentStock: "Trenutna zaloga",
  units: "kos",
  addMovement: "Zapiši gib",

  // Obrazec giba
  directionLabel: "Smer",
  directionIn: "Prihod (+)",
  directionOut: "Odhod (−)",
  variantLabel: "Varianta",
  productOption: "Osnovni izdelek",
  quantityLabel: "Količina *",
  noteLabel: "Opomba",
  notePlaceholder: "npr. dobava št. 123, odpis …",
  supplierLabel: "Dobavitelj",
  supplierPlaceholder: "Izbirno — iz evidenc dobaviteljev",
  batchLabel: "Serija / lot",
  batchPlaceholder: "Izbirno — iz evidenc serij",
  submitMovement: "Shrani gib",
  cancel: "Prekliči",

  // Zgodovina gibov
  historyTitle: "Zadnji gibi",
  colDate: "Datum",
  colDirection: "Smer",
  colQuantity: "Količina",
  colNote: "Opomba",
  colSource: "Vir",
  sourceManual: "Ročno",
  sourceOrder: "Naročilo",
  noMovements: "Še ni zapisanih gibov. Prvi gib zapišite z obrazcem zgoraj.",
  emptyHistory: "Ni gibov za prikaz.",

  // Rezultati / napake (server kodi → besedilo)
  okSaved: "Gib zaloge je shranjen.",
  errInvalidQuantity: "Količina mora biti pozitivno celo število.",
  errNegativeStock:
    "Odhod zavrnjen — zaloga ne sme postati negativna. Najprej zapišite prihod.",
  errNotFound: "Izdelek ne obstaja ali ni vaš.",
  errVariantMismatch: "Izbrana varianta ne pripada temu izdelku.",
  errRecordLink:
    "Izbrana povezava (dobavitelj/serija) ne obstaja v vaših evidencah.",
  errNotTracked:
    "Ta izdelek ne sledi zalogi. Vklopite sledenje zalogi v podatkih o izdelku.",
  errGeneric: "Zapisovanje giba ni uspelo. Poskusite znova.",

  // Dashboard widget: seštevek zaloge
  widgetTitle: "Zaloga",
  widgetDesc: "Seštevek zaloge izdelkov",
  widgetInStock: "Na zalogi",
  widgetLow: "Nizka",
  widgetOut: "Brez",
  widgetLowListTitle: "Izdelki z nizko zalogo",
  widgetEmpty: "Ni izdelkov za prikaz.",
  widgetManage: "Upravljaj izdelke",
}

export type InventoryDict = typeof inventorySl

export const inventoryEn: InventoryDict = {
  // Stock movements card (on the product)
  movementsTitle: "Stock movements",
  movementsDesc:
    "Receipts and issues — every movement is written to the ledger and immediately updates the stock level.",
  currentStock: "Current stock",
  units: "pcs",
  addMovement: "Record movement",

  // Movement form
  directionLabel: "Direction",
  directionIn: "Receipt (+)",
  directionOut: "Issue (−)",
  variantLabel: "Variant",
  productOption: "Base product",
  quantityLabel: "Quantity *",
  noteLabel: "Note",
  notePlaceholder: "e.g. delivery #123, write-off …",
  supplierLabel: "Supplier",
  supplierPlaceholder: "Optional — from supplier records",
  batchLabel: "Batch / lot",
  batchPlaceholder: "Optional — from batch records",
  submitMovement: "Save movement",
  cancel: "Cancel",

  // Movement history
  historyTitle: "Recent movements",
  colDate: "Date",
  colDirection: "Direction",
  colQuantity: "Quantity",
  colNote: "Note",
  colSource: "Source",
  sourceManual: "Manual",
  sourceOrder: "Order",
  noMovements: "No movements yet. Record the first one with the form above.",
  emptyHistory: "No movements to show.",

  // Results / errors (server codes → text)
  okSaved: "Stock movement saved.",
  errInvalidQuantity: "Quantity must be a positive whole number.",
  errNegativeStock:
    "Issue rejected — stock must not go negative. Record a receipt first.",
  errNotFound: "The product does not exist or is not yours.",
  errVariantMismatch: "The selected variant does not belong to this product.",
  errRecordLink:
    "The selected link (supplier/batch) does not exist in your records.",
  errNotTracked:
    "This product does not track stock. Enable stock tracking in the product details.",
  errGeneric: "Recording the movement failed. Please try again.",

  // Dashboard widget: stock summary
  widgetTitle: "Stock",
  widgetDesc: "Product stock summary",
  widgetInStock: "In stock",
  widgetLow: "Low",
  widgetOut: "Out",
  widgetLowListTitle: "Products with low stock",
  widgetEmpty: "No products to show.",
  widgetManage: "Manage products",
}
