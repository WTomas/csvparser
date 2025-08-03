import { Parser } from "../src";
import fs from "fs";
import path from "path";

describe("Case-Insensitive Column Matching", () => {
  const fixturesPath = path.join(__dirname, "fixtures");

  describe("Default case-sensitive behavior", () => {
    it("should match columns case-sensitively by default", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Age", "age", { transform: (v) => parseInt(v) });

      const csv = "name,AGE\nJohn,30"; // Different case headers
      const result = parser.parse(csv);

      // Should fail to match because case sensitivity is default
      expect(result.success).toHaveLength(0);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].type).toBe("missing");
      expect(result.errors[0].message).toContain('Column "Name" not found');
      expect(result.errors[1].type).toBe("missing");
      expect(result.errors[1].message).toContain('Column "Age" not found');
    });

    it("should match exact case columns successfully", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Age", "age", { transform: (v) => parseInt(v) })
        .col("Email", "email");

      const csv = "Name,Age,Email\nJohn,30,john@example.com\nJane,25,jane@example.com";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({
        name: "John",
        age: 30,
        email: "john@example.com"
      });
    });

    it("should handle mixed case mismatches gracefully", () => {
      const parser = new Parser()
        .col("First_Name", "firstName")
        .col("Last_Name", "lastName")
        .col("email_address", "email");

      const csv = "FIRST_NAME,last_name,EMAIL_ADDRESS\nJohn,Doe,john@example.com";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(0);
      expect(result.errors).toHaveLength(3); // All three columns should fail
    });
  });

  describe("Parser-level case-insensitive matching", () => {
    it("should match columns case-insensitively when parser option is enabled", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col("Name", "name")
        .col("Age", "age", { transform: (v) => parseInt(v) });

      const csv = "name,AGE\nJohn,30"; // Different case headers
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(result.success[0]).toEqual({ name: "John", age: 30 });
      expect(result.errors).toHaveLength(0);
    });

    it("should match columns with mixed case variations", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col("First_Name", "firstName")
        .col("Last_Name", "lastName")
        .col("Email_Address", "email");

      const csv = "FIRST_NAME,last_name,Email_Address\nJohn,Doe,john@example.com";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(result.success[0]).toEqual({
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com"
      });
    });

    it("should prioritize exact case matches over case-insensitive matches", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col("Name", "name");

      // CSV has both "Name" and "name" columns
      const csv = "Name,name,Age\nJohn,Jane,30";
      const result = parser.parse(csv);

      // Should match the exact case "Name" column, not "name"
      expect(result.success).toHaveLength(1);
      expect(result.success[0]).toEqual({ name: "John" });
    });

    it("should handle case-insensitive matching from fixture file", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col("FIRST_NAME", "firstName")
        .col("last_name", "lastName")
        .col("Email_Address", "emailAddress");

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "mixed-case-headers.csv"),
        "utf-8"
      );
      const result = parser.parse(csvContent);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({
        firstName: "John",
        lastName: "Doe",
        emailAddress: "john@example.com"
      });
      expect(result.success[1]).toEqual({
        firstName: "Jane",
        lastName: "Smith",
        emailAddress: "jane@example.com"
      });
    });

    it("should work with all uppercase headers", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col("product_id", "productId")
        .col("product_name", "productName")
        .col("unit_price", "unitPrice", { transform: (v) => parseFloat(v) });

      const csv = "PRODUCT_ID,PRODUCT_NAME,UNIT_PRICE\nP001,Widget,19.99\nP002,Gadget,29.99";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({
        productId: "P001",
        productName: "Widget",
        unitPrice: 19.99
      });
    });

    it("should work with all lowercase headers", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col("CUSTOMER_ID", "customerId")
        .col("FIRST_NAME", "firstName")
        .col("LAST_NAME", "lastName");

      const csv = "customer_id,first_name,last_name\nC001,John,Smith\nC002,Jane,Doe";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({
        customerId: "C001",
        firstName: "John",
        lastName: "Smith"
      });
    });

    it("should handle camelCase to snake_case matching", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col("firstName", "firstName")
        .col("lastName", "lastName")
        .col("emailAddress", "emailAddress");

      const csv = "FIRST_NAME,LAST_NAME,EMAIL_ADDRESS\nJohn,Doe,john@example.com";
      const result = parser.parse(csv);

      // This test shows limitation - case insensitive doesn't handle naming convention conversion
      // It only matches exact letters ignoring case, not different naming conventions
      expect(result.success).toHaveLength(0);
      expect(result.errors).toHaveLength(3);
    });
  });

  describe("Column-level case-insensitive overrides", () => {
    it("should support column-level case-insensitive override", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: false })
        .col("Name", "name") // Case-sensitive by default
        .col("Age", "age", { 
          transform: (v) => parseInt(v),
          caseInsensitiveColumnNames: true // Override for this column
        });

      const csv = "Name,AGE\nJohn,30"; // "Name" matches exactly, "AGE" is different case
      const result = parser.parse(csv);

      // Name should succeed (exact match), Age should succeed (case-insensitive override)
      expect(result.success).toHaveLength(1);
      expect(result.success[0]).toEqual({ name: "John", age: 30 });
      expect(result.errors).toHaveLength(0);
    });

    it("should fail column-level case-sensitive when no exact match", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: false })
        .col("name", "name") // Case-sensitive by default, looking for lowercase "name"
        .col("Age", "age", { 
          transform: (v) => parseInt(v),
          caseInsensitiveColumnNames: true // Override for this column
        });

      const csv = "Name,AGE\nJohn,30"; // "Name" is different case, "AGE" is different case
      const result = parser.parse(csv);

      // Name should fail (case-sensitive mismatch), Age should succeed (case-insensitive)
      expect(result.success).toHaveLength(0); // Row fails because name is missing
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Column "name" not found');
    });

    it("should support column-level case-sensitive override", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col("Name", "name", { caseInsensitiveColumnNames: false }) // Override to case-sensitive
        .col("Age", "age", { transform: (v) => parseInt(v) }); // Use parser default (case-insensitive)

      const csv = "name,AGE\nJohn,30"; // "name" is different case
      const result = parser.parse(csv);

      // Name should fail (overridden to case-sensitive), Age should succeed (case-insensitive)
      expect(result.success).toHaveLength(0); // Row fails because Name is missing
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Column "Name" not found');
    });

    it("should handle mixed column-level overrides", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col("Name", "name", { caseInsensitiveColumnNames: false }) // Override to case-sensitive
        .col("Age", "age", { transform: (v) => parseInt(v) }) // Use parser default (case-insensitive)
        .col("Email", "email", { caseInsensitiveColumnNames: false }) // Override to case-sensitive
        .col("City", "city"); // Use parser default (case-insensitive)

      const csv = "Name,AGE,Email,CITY\nJohn,30,john@example.com,Seattle";
      const result = parser.parse(csv);

      // Name matches exactly (case-sensitive), Age matches (case-insensitive), 
      // Email matches exactly (case-sensitive), City matches (case-insensitive)
      expect(result.success).toHaveLength(1);
      expect(result.success[0]).toEqual({
        name: "John",
        age: 30,
        email: "john@example.com",
        city: "Seattle"
      });
    });

    it("should handle all columns with case-sensitive override", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col("Name", "name", { caseInsensitiveColumnNames: false })
        .col("Age", "age", { 
          transform: (v) => parseInt(v),
          caseInsensitiveColumnNames: false 
        })
        .col("Email", "email", { caseInsensitiveColumnNames: false });

      const csv = "name,age,email\nJohn,30,john@example.com"; // All lowercase
      const result = parser.parse(csv);

      // All columns should fail because they're overridden to case-sensitive
      expect(result.success).toHaveLength(0);
      expect(result.errors).toHaveLength(3);
    });
  });

  describe("Case-insensitive with column aliases", () => {
    it("should work with multiple column names (aliases) in case-insensitive mode", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col(["Full Name", "Name", "full_name"], "name")
        .col("Age", "age", { transform: (v) => parseInt(v) });

      const csv = "FULL_NAME,age\nJohn Doe,30";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(result.success[0]).toEqual({ name: "John Doe", age: 30 });
    });

    it("should prioritize exact matches in aliases with case-insensitive mode", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col(["Name", "full_name", "FULL_NAME"], "name");

      // CSV has "FULL_NAME" which matches exactly one of the aliases
      const csv = "FULL_NAME,other\nJohn Doe,value";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(result.success[0]).toEqual({ name: "John Doe" });
    });

    it("should find case-insensitive match when no exact alias match exists", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col(["customer_name", "client_name"], "name");

      // CSV has "CUSTOMER_NAME" which matches case-insensitively
      const csv = "CUSTOMER_NAME,other\nJohn Doe,value";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(result.success[0]).toEqual({ name: "John Doe" });
    });

    it("should handle mixed case aliases with column-level override", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: false })
        .col(["Name", "FULL_NAME"], "name", { caseInsensitiveColumnNames: true })
        .col("Age", "age", { transform: (v) => parseInt(v) });

      const csv = "full_name,Age\nJohn Doe,30"; // "full_name" doesn't exactly match aliases but should work with override
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(result.success[0]).toEqual({ name: "John Doe", age: 30 });
    });
  });

  describe("Special characters and Unicode", () => {
    it("should handle case-insensitive matching with special characters", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col("User-Name", "userName")
        .col("E-Mail", "email")
        .col("Phone#", "phone");

      const csv = "user-name,E-MAIL,phone#\nJohn,john@example.com,555-1234";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(result.success[0]).toEqual({
        userName: "John",
        email: "john@example.com",
        phone: "555-1234"
      });
    });

    it("should handle case-insensitive matching with unicode characters", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col("Prénom", "firstName")
        .col("Âge", "age", { transform: (v) => parseInt(v) })
        .col("Ville", "city");

      const csv = "PRÉNOM,âge,VILLE\nJean,25,Paris";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(result.success[0]).toEqual({ firstName: "Jean", age: 25, city: "Paris" });
    });

    it("should handle case-insensitive matching with numbers and symbols", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col("Column1", "col1")
        .col("Data_2023", "data2023")
        .col("Value$", "value");

      const csv = "COLUMN1,data_2023,value$\nA,B,C";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(result.success[0]).toEqual({ col1: "A", data2023: "B", value: "C" });
    });

    it("should handle whitespace in column names with case-insensitive matching", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col("First Name", "firstName")
        .col("Last  Name", "lastName") // Extra space
        .col(" Email ", "email"); // Leading/trailing spaces

      const csv = "FIRST NAME,last  name, email \nJohn,Doe,john@example.com";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(result.success[0]).toEqual({
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com"
      });
    });
  });

  describe("Edge cases and error scenarios", () => {
    it("should handle duplicate headers with case variations", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col("Name", "name");

      // CSV has both "Name" and "NAME" - should prioritize exact match
      const csv = "Name,NAME,Other\nJohn,Jane,Other";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(result.success[0]).toEqual({ name: "John" }); // Should pick "Name" over "NAME"
    });

    it("should handle empty column names with case-insensitive matching", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col("Name", "name")
        .col("", "empty", { nullable: true }); // Empty column name

      const csv = "NAME,\nJohn,value";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(result.success[0]).toEqual({ name: "John", empty: "value" });
    });

    it("should handle case-insensitive matching with transform and validation", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col("AGE", "age", {
          transform: (v) => parseInt(v),
          validate: (v) => v >= 0 ? undefined : "Age must be non-negative"
        })
        .col("EMAIL", "email", {
          validate: (v) => v.includes("@") ? undefined : "Invalid email format"
        });

      const csv = "age,Email\n25,john@example.com\n-5,invalid-email";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(result.success[0]).toEqual({ age: 25, email: "john@example.com" });
      expect(result.errors).toHaveLength(2); // Age validation error and email validation error
    });

    it("should report missing columns correctly in case-insensitive mode", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col("Name", "name")
        .col("NotFound", "notFound");

      const csv = "NAME,Other\nJohn,value";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("missing");
      expect(result.errors[0].message).toContain('Column "NotFound" not found');
    });

    it("should handle very long column names with case variations", () => {
      const longColumnName = "This_Is_A_Very_Long_Column_Name_With_Many_Words_And_Underscores";
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col(longColumnName, "longColumn");

      const csv = `${longColumnName.toLowerCase()}\nvalue`;
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(result.success[0]).toEqual({ longColumn: "value" });
    });
  });

  describe("Performance and consistency", () => {
    it("should handle large number of columns with case-insensitive matching", () => {
      let parser = new Parser({ caseInsensitiveColumnNames: true });
      const columnNames: string[] = [];
      const headerNames: string[] = [];
      
      // Create 50 columns
      for (let i = 1; i <= 50; i++) {
        const colName = `Column${i}`;
        const headerName = i % 2 === 0 ? colName.toUpperCase() : colName.toLowerCase();
        columnNames.push(colName);
        headerNames.push(headerName);
        parser = parser.col(colName, `col${i}`);
      }

      const csv = headerNames.join(",") + "\n" + Array(50).fill("value").join(",");
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(Object.keys(result.success[0])).toHaveLength(50);
      expect(result.hasErrors).toBe(false);
    });

    it("should be consistent with case-insensitive matching across multiple rows", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col("Name", "name")
        .col("Age", "age", { transform: (v) => parseInt(v) });

      const csv = "NAME,age\nJohn,30\nJane,25\nBob,35\nAlice,28";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(4);
      expect(result.hasErrors).toBe(false);
      result.success.forEach(row => {
        expect(row).toHaveProperty("name");
        expect(row).toHaveProperty("age");
        expect(typeof row.name).toBe("string");
        expect(typeof row.age).toBe("number");
      });
    });
  });

  describe("Integration with other parser options", () => {
    it("should work with custom delimiters and case-insensitive matching", () => {
      const parser = new Parser({ 
        delimiter: ";", 
        caseInsensitiveColumnNames: true 
      })
        .col("Name", "name")
        .col("Age", "age", { transform: (v) => parseInt(v) });

      const csv = "NAME;AGE\nJohn;30\nJane;25";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({ name: "John", age: 30 });
    });

    it("should work with skipRows and case-insensitive matching", () => {
      const parser = new Parser({ 
        skipRows: 2, 
        caseInsensitiveColumnNames: true 
      })
        .col("Name", "name")
        .col("Age", "age", { transform: (v) => parseInt(v) });

      const csv = "# Comment\n# Another comment\nNAME,AGE\nJohn,30\nJane,25";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({ name: "John", age: 30 });
    });

    it("should work with nullable columns and case-insensitive matching", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col("Name", "name")
        .col("Optional", "optional", { nullable: true });

      const csv = "NAME,OPTIONAL\nJohn,\nJane,value";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({ name: "John", optional: null });
      expect(result.success[1]).toEqual({ name: "Jane", optional: "value" });
    });

    it("should work with default values and case-insensitive matching", () => {
      const parser = new Parser({ caseInsensitiveColumnNames: true })
        .col("Name", "name")
        .col("Status", "status", { defaultValue: "active" });

      const csv = "NAME\nJohn\nJane";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({ name: "John", status: "active" });
      expect(result.success[1]).toEqual({ name: "Jane", status: "active" });
    });
  });
});