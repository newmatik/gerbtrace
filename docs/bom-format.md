# BOM File Format

Gerbtrace can import Bill of Materials files and enrich them with pricing and availability data from the Elexess API.

## Supported file types

| Extension | Format |
|-----------|--------|
| `.csv`    | Comma-separated values |
| `.tsv`    | Tab-separated values |
| `.txt`    | Tab- or comma-separated (auto-detected) |
| `.xlsx`   | Microsoft Excel (first sheet is used) |
| `.xls`    | Legacy Excel (first sheet is used) |

## File naming

The file name must contain one of these keywords (case-insensitive) to be recognised as a BOM:

- `bom`
- `bill-of-materials` / `bill_of_materials`
- `stückliste` / `stueckliste`

Examples: `BOM.csv`, `project-bom.xlsx`, `Bill_of_Materials.tsv`

## Delimiter detection (CSV/TSV/TXT)

The parser auto-detects the delimiter by inspecting the first 5 lines:

1. If any line contains a **tab**, the file is tab-delimited.
2. Otherwise, if any line contains a **semicolon**, the file is semicolon-delimited (common in European exports).
3. Otherwise, the file is treated as **comma-delimited**.

Quoted fields (double quotes) are supported. Escaped quotes inside quoted fields use `""`.

## Columns

The first row must be a header row. Columns are auto-mapped by matching the header text against known keywords. All matching is case-insensitive and ignores non-alphanumeric characters (spaces, underscores, hyphens are stripped before matching).

| Field | Required | Recognised header names | Description |
|-------|----------|------------------------|-------------|
| **References** | Yes | `References`, `Ref Des`, `Ref`, `Reference Designators`, `Refs`, `Designators`, `Designator`, `Parts` | Component reference designators, comma-separated (e.g. `R1, R2, R3`) |
| **Quantity** | Yes | `Quantity`, `Qty`, `Count`, `Amount`, `Pcs`, `Pieces`, `Number` | Number of components |
| **Description** | No | `Description`, `Desc`, `Component`, `Comp`, `Part Description`, `Part Desc` | Component description |
| **Type** | No | `Type`, `Component Type`, `Comp Type`, `Mount Type`, `Mounting Type`, `Category` | One of: `SMD`, `THT`, `Mounting`, `Other` |
| **Customer Provided** | No | `Customer Provided`, `Cust Provided`, `Customer`, `Customer Supplied`, `Cust Supplied` | `Yes`/`No`/`True`/`False`/`1`/`0` |
| **Customer Item No** | No | `Customer Item No`, `Cust Item No`, `Customer Item`, `Customer Part Number`, `Customer Part No`, `Cust Part No`, `Cust PN` | Customer's own part number |
| **Package** | No | `Package`, `Footprint`, `Pkg`, `FP`, `Land`, `Land Pattern`, `Case`, `Case Code` | Package or footprint name |
| **Comment** | No | `Comment`, `Comments`, `Note`, `Notes`, `Remark`, `Remarks` | Free-form text |
| **Manufacturer** | No | `Manufacturer`, `Mfr`, `Mfg`, `Make`, `Vendor`, `Brand` | Manufacturer name |
| **Manufacturer Part** | No | `Manufacturer Part`, `MPN`, `MFPN`, `Manufacturer Part Number`, `Mfr Part`, `Mfg Part`, `Mfr PN`, `Mfg PN`, `Part No`, `Part Number` | Manufacturer part number (used for Elexess pricing lookup) |

At least **2 columns** must be successfully matched for auto-detection to succeed. If auto-detection fails, Gerbtrace will prompt you to manually map the columns.

## Type values

The **Type** column accepts these values (case-insensitive):

| Value | Recognised variants |
|-------|-------------------|
| `SMD` | `SMD`, `SMT` |
| `THT` | `THT`, `THD`, `Through Hole`, `Through` |
| `Mounting` | `Mounting`, `Mech`, `Mechanical` |
| `Other` | Anything else, or when the column is missing |

## Multiple manufacturers per line

A single component can have multiple manufacturer options. There are two ways to represent this:

### Option A: Repeated rows with the same references

Duplicate the row for each alternate manufacturer. The parser groups rows by the **References** column and merges manufacturer entries:

```
References,Quantity,Description,Manufacturer,MPN
"R1, R2",2,10K Resistor,Yageo,RC0402FR-0710KL
"R1, R2",2,10K Resistor,Samsung,RC1005F1002CS
```

This produces one BOM line with two manufacturers.

### Option B: Manual entry in the UI

After importing, click any BOM line and use the edit modal to add additional manufacturers.

## Customer Provided column

The **Customer Provided** column indicates whether the customer supplies this component (i.e. it does not need to be sourced). Accepted true values: `Yes`, `True`, `1`, `Y`. Everything else is treated as false.

## Example BOM file

```csv
References,Quantity,Description,Type,Package,Manufacturer,MPN,Customer Provided,Comment
"R1, R2, R3",3,10K 0402 Resistor,SMD,0402,Yageo,RC0402FR-0710KL,No,
"C1, C2",2,100nF MLCC,SMD,0402,Samsung,CL05B104KO5NNNC,No,
U1,1,ARM Cortex-M0+ MCU,SMD,QFP-48,Microchip,PIC16F684-I/ST,No,Main controller
J1,1,USB-C Connector,SMD,USB-C,Wurth,632723300011,No,
H1,1,M3 Standoff,Mounting,,,,Yes,Customer supplies standoffs
```

## Field mapping fallback

If the parser cannot auto-detect your column layout (fewer than 2 columns matched), a mapping dialog will appear. You can manually assign each BOM field to a column from your file. A preview of the first 3 data rows is shown to help verify the mapping.
