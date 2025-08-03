import { Parser } from "../src";
import fs from "fs";
import path from "path";

describe("Parser Options", () => {
  const fixturesPath = path.join(__dirname, "fixtures");

  describe("Custom delimiters", () => {
    it("should parse semicolon-separated files", () => {
      const parser = new Parser({ delimiter: ";" })
        .col("Name", "name")
        .col("Age", "age", { transform: (v) => parseInt(v) })
        .col("City", "city")
        .col("Country", "country");

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "semicolon-separated.csv"),
        "utf-8"
      );
      const result = parser.parse(csvContent);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(3);
      expect(result.success[0]).toEqual({
        name: "Jean Dupont",
        age: 35,
        city: "Paris",
        country: "France",
      });
      expect(result.success[1]).toEqual({
        name: "Maria Garcia",
        age: 28,
        city: "Barcelona",
        country: "Spain",
      });
    });

    it("should parse tab-separated files", () => {
      const parser = new Parser({ delimiter: "\t" })
        .col("Name", "name")
        .col("Age", "age", { transform: (v) => parseInt(v) })
        .col("Department", "department")
        .col("Location", "location");

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "tab-separated.tsv"),
        "utf-8"
      );
      const result = parser.parse(csvContent);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(3);
      expect(result.success[0]).toEqual({
        name: "John Smith",
        age: 30,
        department: "Engineering",
        location: "New York",
      });
    });

    it("should parse pipe-separated files", () => {
      const parser = new Parser({ delimiter: "|" })
        .col("Name", "name")
        .col("Age", "age", { transform: (v) => parseInt(v) })
        .col("City", "city")
        .col("Country", "country");

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "pipe-separated.csv"),
        "utf-8"
      );
      const result = parser.parse(csvContent);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(3);
      expect(result.success[0]).toEqual({
        name: "John Doe",
        age: 30,
        city: "New York",
        country: "USA",
      });
    });

    it("should handle custom delimiters with quoted fields", () => {
      const parser = new Parser({ delimiter: ";" })
        .col("Name", "name")
        .col("Description", "description");

      const csv =
        'Name;Description\n"John Doe";"A person; with semicolons"\n"Jane Smith";"Another; person"';
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({
        name: "John Doe",
        description: "A person; with semicolons",
      });
    });

    it("should handle multi-character delimiters", () => {
      const parser = new Parser({ delimiter: "::" })
        .col("Name", "name")
        .col("Value", "value");

      const csv = "Name::Value\nJohn::123\nJane::456";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({ name: "John", value: "123" });
      expect(result.success[1]).toEqual({ name: "Jane", value: "456" });
    });
  });

  describe("Custom quote characters", () => {
    it("should handle single quotes as quote characters", () => {
      const parser = new Parser({ quote: "'" })
        .col("Name", "name")
        .col("Description", "description");

      const csv =
        "Name,Description\n'John Doe','A software engineer'\n'Jane Smith','Product manager'";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({
        name: "John Doe",
        description: "A software engineer",
      });
    });

    it("should handle custom quote with escaped quotes", () => {
      const parser = new Parser({ quote: "'", escape: "'" })
        .col("Name", "name")
        .col("Quote", "quote");

      const csv =
        "Name,Quote\n'John','He said ''Hello'''\n'Jane','She said ''Hi'''";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({
        name: "John",
        quote: "He said 'Hello'",
      });
      expect(result.success[1]).toEqual({
        name: "Jane",
        quote: "She said 'Hi'",
      });
    });

    it("should handle backticks as quote characters", () => {
      const parser = new Parser({ quote: "`" })
        .col("Command", "command")
        .col("Description", "description");

      const csv =
        "Command,Description\n`ls -la`,`List all files`\n`grep test`,`Search for test`";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({
        command: "ls -la",
        description: "List all files",
      });
    });
  });

  describe("Custom escape characters", () => {
    it("should handle backslash as escape character", () => {
      const parser = new Parser({ escape: "\\" })
        .col("Name", "name")
        .col("Quote", "quote");

      const csv =
        'Name,Quote\n"John","He said \\"Hello\\""\n"Jane","She said \\"Hi\\""';
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({
        name: "John",
        quote: 'He said "Hello"',
      });
      expect(result.success[1]).toEqual({
        name: "Jane",
        quote: 'She said "Hi"',
      });
    });

    it("should handle different quote and escape characters", () => {
      const parser = new Parser({ quote: "'", escape: "\\" })
        .col("Name", "name")
        .col("Quote", "quote");

      const csv =
        "Name,Quote\n'John','He said \\'Hello\\''\n'Jane','She said \\'Hi\\''";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({
        name: "John",
        quote: "He said 'Hello'",
      });
      expect(result.success[1]).toEqual({
        name: "Jane",
        quote: "She said 'Hi'",
      });
    });

    it("should handle caret as escape character", () => {
      const parser = new Parser({ escape: "^" }).col("Text", "text");

      const csv = 'Text\n"He said ^"Hello^""\n"She replied ^"Hi^""';
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0].text).toBe('He said "Hello"');
      expect(result.success[1].text).toBe('She replied "Hi"');
    });
  });

  describe("Skip rows option", () => {
    it("should skip specified number of header rows", () => {
      const parser = new Parser({ skipRows: 3 })
        .col("Name", "name")
        .col("Age", "age", { transform: (v) => parseInt(v) })
        .col("Email", "email");

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "with-comments.csv"),
        "utf-8"
      );
      const result = parser.parse(csvContent);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({
        name: "John Doe",
        age: 30,
        email: "john@example.com",
      });
    });

    it("should handle skipRows greater than total rows", () => {
      const parser = new Parser({ skipRows: 10 })
        .col("Name", "name")
        .col("Age", "age");

      const csv = "Name,Age\nJohn,30\nJane,25";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(0);
    });

    it("should handle skipRows equal to total rows", () => {
      const parser = new Parser({ skipRows: 3 })
        .col("Name", "name")
        .col("Age", "age");

      const csv = "Name,Age\nJohn,30\nJane,25";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(0);
    });

    it("should handle skipRows with custom delimiters", () => {
      const parser = new Parser({ skipRows: 2, delimiter: ";" })
        .col("Name", "name")
        .col("Age", "age", { transform: (v) => parseInt(v) });

      const csv =
        "# Comment line\n# Another comment\nName;Age\nJohn;30\nJane;25";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({ name: "John", age: 30 });
    });
  });

  describe("Skip empty lines option", () => {
    it("should skip empty lines by default", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Age", "age", { transform: (v) => parseInt(v) });

      const csv = "Name,Age\n\nJohn,30\n\n\nJane,25\n\n";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({ name: "John", age: 30 });
      expect(result.success[1]).toEqual({ name: "Jane", age: 25 });
    });

    it("should preserve empty lines when skipEmptyLines is false", () => {
      const parser = new Parser({ skipEmptyLines: false })
        .col("Name", "name", { nullable: true })
        .col("Age", "age", { nullable: true });

      const csv = "Name,Age\n\nJohn,30\n\nJane,25";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(4);
      expect(result.success[0]).toEqual({ name: null, age: null });
      expect(result.success[1]).toEqual({ name: "John", age: "30" });
      expect(result.success[2]).toEqual({ name: null, age: null });
      expect(result.success[3]).toEqual({ name: "Jane", age: "25" });
    });

    it("should handle lines with only whitespace", () => {
      const parser = new Parser({ skipEmptyLines: true })
        .col("Name", "name")
        .col("Age", "age", { transform: (v) => parseInt(v) });

      const csv = "Name,Age\n   \nJohn,30\n\t\t\nJane,25\n     ";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({ name: "John", age: 30 });
      expect(result.success[1]).toEqual({ name: "Jane", age: 25 });
    });

    it("should not skip empty lines within quoted fields", () => {
      const parser = new Parser({ skipEmptyLines: true })
        .col("Name", "name")
        .col("Description", "description");

      const csv =
        'Name,Description\n"John","Line 1\n\nLine 3"\n"Jane","Single line"';
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({
        name: "John",
        description: "Line 1\n\nLine 3",
      });
      expect(result.success[1]).toEqual({
        name: "Jane",
        description: "Single line",
      });
    });
  });

  describe("Trim option", () => {
    it("should trim whitespace by default", () => {
      const parser = new Parser().col("Name", "name").col("Email", "email");

      const csv =
        "Name,Email\n  John Doe  ,  john@example.com  \n  Jane Smith  ,  jane@example.com  ";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success[0].name).toBe("John Doe");
      expect(result.success[0].email).toBe("john@example.com");
    });

    it("should not trim when global trim option is false", () => {
      const parser = new Parser({ trim: false })
        .col("Name", "name")
        .col("Email", "email");

      const csv = "Name,Email\n  John Doe  ,  john@example.com  ";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success[0].name).toBe("  John Doe  ");
      expect(result.success[0].email).toBe("  john@example.com  ");
    });

    it("should allow column-level trim override", () => {
      const parser = new Parser({ trim: false })
        .col("Name", "name", { trim: true }) // Override to trim
        .col("Email", "email"); // Use parser default (no trim)

      const csv = "Name,Email\n  John Doe  ,  john@example.com  ";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success[0].name).toBe("John Doe");
      expect(result.success[0].email).toBe("  john@example.com  ");
    });
  });

  describe("Combined parser options", () => {
    it("should handle all options together", () => {
      const parser = new Parser({
        delimiter: ";",
        quote: "'",
        escape: "'",
        skipRows: 2,
        skipEmptyLines: true,
        trim: true,
      })
        .col("Name", "name")
        .col("Description", "description")
        .col("Notes", "notes", { nullable: true });

      const csv =
        "# Comment 1\n# Comment 2\n\nName;Description;Notes\n'John Doe';'A person; with ''special'' chars';\n\n'Jane Smith';'Another person';\n\n";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({
        name: "John Doe",
        description: "A person; with 'special' chars",
        notes: null,
      });
      expect(result.success[1]).toEqual({
        name: "Jane Smith",
        description: "Another person",
        notes: null,
      });
    });

    it("should handle complex real-world scenario with all options", () => {
      const parser = new Parser({
        delimiter: "\t",
        skipRows: 1,
        skipEmptyLines: true,
        trim: true,
      })
        .col("Product ID", "productId")
        .col("Name", "name")
        .col("Price", "price", {
          transform: (v) => parseFloat(v),
          validate: (v) => (v > 0 ? undefined : "Price must be positive"),
        })
        .col("Category", "category", { nullable: true })
        .col("In Stock", "inStock", {
          transform: (v) => v.toLowerCase() === "yes",
        });

      const csv =
        "# Product Export - 2024\nProduct ID\tName\tPrice\tCategory\tIn Stock\nP001\tLaptop\t999.99\tElectronics\tYes\nP002\tMouse\t29.99\t\tNo\n\nP003\tKeyboard\t79.99\tElectronics\tYes";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(3);

      expect(result.success[0]).toEqual({
        productId: "P001",
        name: "Laptop",
        price: 999.99,
        category: "Electronics",
        inStock: true,
      });

      expect(result.success[1]).toEqual({
        productId: "P002",
        name: "Mouse",
        price: 29.99,
        category: null,
        inStock: false,
      });

      expect(result.success[2]).toEqual({
        productId: "P003",
        name: "Keyboard",
        price: 79.99,
        category: "Electronics",
        inStock: true,
      });
    });
  });

  describe("Parser option edge cases", () => {
    it("should handle delimiter same as quote character", () => {
      const parser = new Parser({ delimiter: '"', quote: '"' })
        .col("Field1", "field1")
        .col("Field2", "field2");

      const csv = 'Field1"Field2\nValue1"Value2\nValue3"Value4';
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({ field1: "Value1", field2: "Value2" });
    });

    it("should handle very long delimiter", () => {
      const parser = new Parser({ delimiter: "|||" })
        .col("Name", "name")
        .col("Value", "value");

      const csv = "Name|||Value\nJohn|||123\nJane|||456";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({ name: "John", value: "123" });
    });

    it("should handle special Unicode characters as delimiters", () => {
      const parser = new Parser({ delimiter: "¦" })
        .col("Name", "name")
        .col("Value", "value");

      const csv = "Name¦Value\nJohn¦123\nJane¦456";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({ name: "John", value: "123" });
    });
  });
});
