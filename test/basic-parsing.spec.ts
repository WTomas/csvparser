import { Parser } from "../src";
import fs from "fs";
import path from "path";

describe("Basic CSV Parsing", () => {
  const fixturesPath = path.join(__dirname, "fixtures");

  describe("Simple CSV files", () => {
    it("should parse basic CSV with headers and rows", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Age", "age", { transform: (v) => parseInt(v) })
        .col("Email", "email");

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "basic-users.csv"),
        "utf-8"
      );
      const result = parser.parse(csvContent);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(3);
      expect(result.success[0]).toEqual({
        name: "John Doe",
        age: 30,
        email: "john@example.com"
      });
      expect(result.success[1]).toEqual({
        name: "Jane Smith",
        age: 25,
        email: "jane@example.com"
      });
      expect(result.success[2]).toEqual({
        name: "Bob Wilson",
        age: 35,
        email: "bob@example.com"
      });
    });

    it("should parse existing countries CSV", () => {
      const parser = new Parser()
        .col("Country", "country")
        .col("Capital", "capital")
        .col("Missing value", "something", { nullable: true });

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "countries.csv"),
        "utf-8"
      );
      const result = parser.parse(csvContent);

      expect(result.hasErrors).toBe(false);
      expect(result.success.length).toBeGreaterThan(0);
      expect(result.success[0]).toHaveProperty("country");
      expect(result.success[0]).toHaveProperty("capital");
    });
  });

  describe("Complex real-world scenarios", () => {
    it("should parse employee data with various field types", () => {
      const parser = new Parser()
        .col("Employee ID", "employeeId")
        .col("First Name", "firstName")
        .col("Last Name", "lastName")
        .col("Department", "department")
        .col("Hire Date", "hireDate", {
          transform: (v) => new Date(v)
        })
        .col("Salary", "salary", {
          transform: (v) => parseFloat(v)
        })
        .col("Active", "active", {
          transform: (v) => v.toLowerCase() === "true"
        })
        .col("Manager ID", "managerId", { nullable: true })
        .col("Skills", "skills", {
          transform: (v) => v.split(",").map(s => s.trim())
        });

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "employees.csv"),
        "utf-8"
      );
      const result = parser.parse(csvContent);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(4);

      const john = result.success[0];
      expect(john.employeeId).toBe("E001");
      expect(john.firstName).toBe("John");
      expect(john.lastName).toBe("Doe");
      expect(john.department).toBe("Engineering");
      expect(john.hireDate).toEqual(new Date("2020-01-15"));
      expect(john.salary).toBe(75000.0);
      expect(john.active).toBe(true);
      expect(john.managerId).toBe("M001");
      expect(john.skills).toEqual(["JavaScript", "TypeScript", "React"]);

      // Test employee with null manager
      const alice = result.success[3];
      expect(alice.managerId).toBeNull();
      expect(alice.skills).toEqual(["Recruiting", "Employee Relations"]);
    });

    it("should handle quoted fields with complex content", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Description", "description")
        .col("Tags", "tags", {
          transform: (v) => v.split(",").map(s => s.trim())
        });

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "quoted-descriptions.csv"),
        "utf-8"
      );
      const result = parser.parse(csvContent);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(3);

      expect(result.success[0]).toEqual({
        name: "John",
        description: "A software engineer, who loves coding",
        tags: ["programming", "typescript", "nodejs"]
      });

      expect(result.success[1]).toEqual({
        name: "Jane",
        description: 'Product manager with "extensive" experience',
        tags: ["management", "strategy"]
      });

      expect(result.success[2]).toEqual({
        name: "Bob",
        description: 'Designer who says "Hello, World!"',
        tags: ["design", "ui", "ux"]
      });
    });
  });

  describe("Edge cases and special scenarios", () => {
    it("should handle single column CSV", () => {
      const singleColumnCSV = "Name\nJohn\nJane\nBob";
      const parser = new Parser().col("Name", "name");

      const result = parser.parse(singleColumnCSV);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(3);
      expect(result.success[0]).toEqual({ name: "John" });
      expect(result.success[1]).toEqual({ name: "Jane" });
      expect(result.success[2]).toEqual({ name: "Bob" });
    });

    it("should handle single row CSV", () => {
      const singleRowCSV = "Name,Age\nJohn,30";
      const parser = new Parser()
        .col("Name", "name")
        .col("Age", "age", { transform: (v) => parseInt(v) });

      const result = parser.parse(singleRowCSV);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(1);
      expect(result.success[0]).toEqual({ name: "John", age: 30 });
    });

    it("should handle headers-only CSV", () => {
      const headersOnlyCSV = "Name,Age,Email";
      const parser = new Parser()
        .col("Name", "name")
        .col("Age", "age", { transform: (v) => parseInt(v) })
        .col("Email", "email");

      const result = parser.parse(headersOnlyCSV);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(0);
    });

    it("should handle empty CSV", () => {
      const emptyCSV = "";
      const parser = new Parser()
        .col("Name", "name")
        .col("Age", "age");

      const result = parser.parse(emptyCSV);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(0);
    });

    it("should handle CSV with inconsistent column counts", () => {
      const inconsistentCSV = "Name,Age,Email\nJohn,30\nJane,25,jane@example.com,extra";
      const parser = new Parser()
        .col("Name", "name")
        .col("Age", "age", { transform: (v) => parseInt(v) })
        .col("Email", "email", { nullable: true });

      const result = parser.parse(inconsistentCSV);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({ name: "John", age: 30, email: null });
      expect(result.success[1]).toEqual({ name: "Jane", age: 25, email: "jane@example.com" });
    });

    it("should handle complex edge cases", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Description", "description")
        .col("Special", "special", { nullable: true });

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "edge-cases.csv"),
        "utf-8"
      );
      const result = parser.parse(csvContent);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(3);

      expect(result.success[0]).toEqual({
        name: "John",
        description: "Multi-line\ndescription with\nnewlines",
        special: 'quote"inside'
      });

      expect(result.success[1]).toEqual({
        name: "Jane",
        description: "Comma, inside quotes",
        special: "normal"
      });

      expect(result.success[2]).toEqual({
        name: "Bob",
        description: "Simple description",
        special: null
      });
    });
  });

  describe("Type safety verification", () => {
    it("should maintain correct types throughout parsing", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Age", "age", { transform: (v) => parseInt(v) })
        .col("Score", "score", { 
          transform: (v) => parseFloat(v),
          nullable: true 
        })
        .col("Active", "active", { 
          transform: (v) => v.toLowerCase() === "true" 
        });

      const csv = "Name,Age,Score,Active\nJohn,30,95.5,true\nJane,25,,false";
      const result = parser.parse(csv);

      // Compile-time type checking
      const record = result.success[0];
      const name: string = record.name;
      const age: number = record.age;
      const score: number | null = record.score;
      const active: boolean = record.active;

      expect(typeof name).toBe("string");
      expect(typeof age).toBe("number");
      expect(typeof score).toBe("number");
      expect(typeof active).toBe("boolean");

      expect(result.success[1].score).toBeNull();
    });
  });

  describe("Async parsing", () => {
    it("should handle async string parsing", async () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Age", "age", { transform: (v) => parseInt(v) });

      const csvContent = "Name,Age\nJohn,30\nJane,25";
      const result = await parser.parseAsync(csvContent);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({ name: "John", age: 30 });
      expect(result.success[1]).toEqual({ name: "Jane", age: 25 });
    });

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
});