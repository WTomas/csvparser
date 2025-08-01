import { Parser } from "../src";
import fs from "fs";

describe("Parser", () => {
  it("should parse a CSV file", () => {
    const parser = new Parser()
      .col("Country", "country")
      .col("Capital", "capital")
      .col("Missing value", "something", { nullable: true });
    
    const csvContent = fs.readFileSync("test/fixtures/countries.csv", "utf-8");
    const result = parser.parse(csvContent);
    
    expect(result.hasErrors).toBe(false);
    expect(result.success.length).toBeGreaterThan(0);
    expect(result.success[0]).toHaveProperty('country');
    expect(result.success[0]).toHaveProperty('capital');
  });

  it("should handle transform and validation", () => {
    const parser = new Parser()
      .col("Name", "name")
      .col("Age", "age", {
        transform: (v) => parseInt(v),
        validate: (v) => v >= 0 ? undefined : "Age must be non-negative"
      });

    const csv = "Name,Age\nJohn,30\nJane,-5";
    const result = parser.parse(csv);

    expect(result.success.length).toBe(1);
    expect(result.success[0]).toEqual({ name: "John", age: 30 });
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].message).toBe("Age must be non-negative");
  });

  it("should handle nullable fields", () => {
    const parser = new Parser()
      .col("Required", "required")
      .col("Optional", "optional", { nullable: true });

    const csv = "Required,Optional\nValue1,\nValue2,Value3";
    const result = parser.parse(csv);

    expect(result.success.length).toBe(2);
    expect(result.success[0]).toEqual({ required: "Value1", optional: null });
    expect(result.success[1]).toEqual({ required: "Value2", optional: "Value3" });
  });

  it("should correctly type nullable fields", () => {
    const parser = new Parser()
      .col("Name", "name")
      .col("Email", "email", { nullable: true })
      .col("Score", "score", { 
        transform: (v) => parseInt(v),
        nullable: true 
      });

    const csv = "Name,Email,Score\nJohn,john@example.com,100\nJane,,";
    const result = parser.parse(csv);

    // Runtime checks
    expect(result.success[0].name).toBe("John");
    expect(result.success[0].email).toBe("john@example.com");
    expect(result.success[0].score).toBe(100);
    
    expect(result.success[1].name).toBe("Jane");
    expect(result.success[1].email).toBeNull();
    expect(result.success[1].score).toBeNull();

    // Type checks (these would fail at compile time if types were wrong)
    const record = result.success[0];
    const _name: string = record.name;
    const _email: string | null = record.email;
    const _score: number | null = record.score;
  });

  it("should handle multiple column names (aliases)", () => {
    const parser = new Parser()
      .col(["Name", "Full Name", "name"], "name")
      .col("Age", "age", { transform: (v) => parseInt(v) });

    const csv1 = "Name,Age\nJohn,30";
    const csv2 = "Full Name,Age\nJane,25";
    const csv3 = "name,Age\nBob,35";

    const result1 = parser.parse(csv1);
    const result2 = parser.parse(csv2);
    const result3 = parser.parse(csv3);

    expect(result1.success[0]).toEqual({ name: "John", age: 30 });
    expect(result2.success[0]).toEqual({ name: "Jane", age: 25 });
    expect(result3.success[0]).toEqual({ name: "Bob", age: 35 });
  });

  it("should handle default values", () => {
    const parser = new Parser()
      .col("Name", "name")
      .col("Score", "score", { 
        transform: (v) => parseInt(v),
        defaultValue: 0 
      });

    const csv = "Name,Score\nJohn,\nJane,100";
    const result = parser.parse(csv);

    expect(result.success.length).toBe(2);
    expect(result.success[0]).toEqual({ name: "John", score: 0 });
    expect(result.success[1]).toEqual({ name: "Jane", score: 100 });
  });

  it("should collect all errors", () => {
    const parser = new Parser()
      .col("Name", "name")
      .col("Age", "age", {
        transform: (v) => parseInt(v),
        validate: (v) => v >= 0 && v <= 120 ? undefined : "Age must be between 0 and 120"
      })
      .col("Email", "email", {
        validate: (v) => v.includes("@") ? undefined : "Invalid email"
      });

    const csv = "Name,Age,Email\nJohn,-5,invalid\nJane,150,also-invalid\nBob,30,bob@example.com";
    const result = parser.parse(csv);

    expect(result.success.length).toBe(1);
    expect(result.success[0]).toEqual({ name: "Bob", age: 30, email: "bob@example.com" });
    expect(result.errors.length).toBe(4); // 2 errors for first row, 2 for second row
    expect(result.hasErrors).toBe(true);
  });

  it("should handle quoted fields with commas", () => {
    const parser = new Parser()
      .col("Name", "name")
      .col("Description", "description");

    const csv = `Name,Description\nJohn,"A person, with a comma"\nJane,"Another ""quoted"" value"`;
    const result = parser.parse(csv);

    expect(result.success.length).toBe(2);
    expect(result.success[0]).toEqual({ name: "John", description: "A person, with a comma" });
    expect(result.success[1]).toEqual({ name: "Jane", description: 'Another "quoted" value' });
  });

  it("should handle custom delimiters", () => {
    const parser = new Parser({ delimiter: ";" })
      .col("Name", "name")
      .col("Age", "age", { transform: (v) => parseInt(v) });

    const csv = "Name;Age\nJohn;30\nJane;25";
    const result = parser.parse(csv);

    expect(result.success.length).toBe(2);
    expect(result.success[0]).toEqual({ name: "John", age: 30 });
    expect(result.success[1]).toEqual({ name: "Jane", age: 25 });
  });

  it("should handle missing columns", () => {
    const parser = new Parser()
      .col("Name", "name")
      .col("Missing", "missing")
      .col("Optional", "optional", { nullable: true });

    const csv = "Name\nJohn\nJane";
    const result = parser.parse(csv);

    expect(result.success.length).toBe(0);
    expect(result.errors.length).toBe(2);
    expect(result.errors[0].type).toBe("missing");
    expect(result.errors[0].message).toContain('Column "Missing" not found');
  });

  it("should handle transform errors", () => {
    const parser = new Parser()
      .col("Name", "name")
      .col("Data", "data", {
        transform: (v) => {
          if (v === "invalid") throw new Error("Cannot transform invalid data");
          return v.toUpperCase();
        }
      });

    const csv = "Name,Data\nJohn,valid\nJane,invalid";
    const result = parser.parse(csv);

    expect(result.success.length).toBe(1);
    expect(result.success[0]).toEqual({ name: "John", data: "VALID" });
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].type).toBe("transform");
    expect(result.errors[0].message).toBe("Cannot transform invalid data");
  });

  it("should handle async string parsing", async () => {
    const parser = new Parser()
      .col("Name", "name")
      .col("Age", "age", { transform: (v) => parseInt(v) });

    const csvContent = "Name,Age\nJohn,30";
    const result = await parser.parseAsync(csvContent);

    expect(result.success.length).toBe(1);
    expect(result.success[0]).toEqual({ name: "John", age: 30 });
  });

  // File parsing test would require FileReader API which is not available in Node.js
  // This would work in a browser environment
  it.skip("should handle async file parsing in browser environment", async () => {
    const parser = new Parser()
      .col("Name", "name")
      .col("Age", "age", { transform: (v) => parseInt(v) });

    const csvContent = "Name,Age\nJohn,30";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const file = new File([blob], "test.csv");

    const result = await parser.parseAsync(file);

    expect(result.success.length).toBe(1);
    expect(result.success[0]).toEqual({ name: "John", age: 30 });
  });
});
