import { Parser } from "../src";
import fs from "fs";
import path from "path";

describe("Error Handling", () => {
  const fixturesPath = path.join(__dirname, "fixtures");

  describe("Transformation errors", () => {
    it("should handle transform errors gracefully", () => {
      const parser = new Parser().col("Name", "name").col("Data", "data", {
        transform: (v) => {
          if (v === "invalid") throw new Error("Cannot transform invalid data");
          return v.toUpperCase();
        },
      });

      const csv = "Name,Data\nJohn,valid\nJane,invalid\nBob,another";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({ name: "John", data: "VALID" });
      expect(result.success[1]).toEqual({ name: "Bob", data: "ANOTHER" });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("transform");
      expect(result.errors[0].message).toBe("Cannot transform invalid data");
      expect(result.errors[0].row).toBe(1); // Jane's row
      expect(result.errors[0].property).toBe("data");
      expect(result.errors[0].value).toBe("invalid");
    });

    it("should handle JSON parsing errors", () => {
      const parser = new Parser().col("Name", "name").col("Config", "config", {
        transform: (v) => JSON.parse(v),
      });

      const csv =
        'Name,Config\nJohn,"{""key"": ""value""}"\nJane,"invalid-json"\nBob,"{""valid"": true}"';
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(2);
      expect(result.success[0].config).toEqual({ key: "value" });
      expect(result.success[1].config).toEqual({ valid: true });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("transform");
      expect(result.errors[0].row).toBe(1); // Jane's row
    });

    it("should handle number parsing errors", () => {
      const parser = new Parser().col("Name", "name").col("Age", "age", {
        transform: (v) => {
          const num = parseInt(v);
          if (isNaN(num)) throw new Error("Invalid number format");
          return num;
        },
      });

      const csv = "Name,Age\nJohn,30\nJane,not-a-number\nBob,25";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Invalid number format");
    });

    it("should handle date parsing errors", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("BirthDate", "birthDate", {
          transform: (v) => {
            const date = new Date(v);
            if (isNaN(date.getTime())) throw new Error("Invalid date format");
            return date;
          },
        });

      const csv =
        "Name,BirthDate\nJohn,1990-05-15\nJane,invalid-date\nBob,1985-12-03";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Invalid date format");
    });
  });

  describe("Validation errors", () => {
    it("should collect all validation errors from fixture", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Age", "age", {
          transform: (v) => parseInt(v),
          validate: (v) =>
            v >= 0 && v <= 120 ? undefined : "Age must be between 0 and 120",
        })
        .col("Email", "email", {
          validate: (v) =>
            v.includes("@") && v.includes(".")
              ? undefined
              : "Invalid email format",
        })
        .col("Salary", "salary", {
          transform: (v) => parseFloat(v),
          validate: (v) => (v > 0 ? undefined : "Salary must be positive"),
        });

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "users-with-errors.csv"),
        "utf-8"
      );
      const result = parser.parse(csvContent);

      expect(result.success).toHaveLength(1); // Only John should succeed
      expect(result.success[0].name).toBe("John Doe");

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.hasErrors).toBe(true);

      // Check specific error types
      const ageErrors = result.errors.filter((e) =>
        e.message.includes("Age must be")
      );
      const emailErrors = result.errors.filter((e) =>
        e.message.includes("Invalid email")
      );
      const salaryErrors = result.errors.filter((e) =>
        e.message.includes("Salary must be")
      );

      expect(ageErrors.length).toBeGreaterThan(0);
      expect(emailErrors.length).toBeGreaterThan(0);
      expect(salaryErrors.length).toBeGreaterThan(0);
    });

    it("should validate email formats", () => {
      const parser = new Parser().col("Name", "name").col("Email", "email", {
        validate: (v) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(v) ? undefined : "Invalid email format";
        },
      });

      const csv =
        "Name,Email\nJohn,john@example.com\nJane,invalid.email\nBob,bob@test\nAlice,alice@domain.com";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(2); // John and Alice
      expect(result.errors).toHaveLength(2); // Jane and Bob

      expect(result.errors[0].row).toBe(1); // Jane
      expect(result.errors[1].row).toBe(2); // Bob
    });

    it("should validate phone numbers", () => {
      const parser = new Parser().col("Name", "name").col("Phone", "phone", {
        validate: (v) => {
          const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/;
          return phoneRegex.test(v)
            ? undefined
            : "Phone must be in format (XXX) XXX-XXXX";
        },
      });

      const csv =
        "Name,Phone\nJohn,(555) 123-4567\nJane,555-123-4567\nBob,(555) 987-6543";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(2); // John and Bob
      expect(result.errors).toHaveLength(1); // Jane
      expect(result.errors[0].message).toBe(
        "Phone must be in format (XXX) XXX-XXXX"
      );
    });

    it("should validate custom business rules", () => {
      const parser = new Parser()
        .col("Employee ID", "employeeId", {
          validate: (v) =>
            /^E\d{3}$/.test(v)
              ? undefined
              : "Employee ID must match pattern E###",
        })
        .col("Department", "department", {
          validate: (v) =>
            ["Engineering", "Marketing", "HR", "Sales"].includes(v)
              ? undefined
              : "Invalid department",
        })
        .col("Level", "level", {
          transform: (v) => parseInt(v),
          validate: (v) =>
            v >= 1 && v <= 10 ? undefined : "Level must be between 1 and 10",
        });

      const csv =
        "Employee ID,Department,Level\nE001,Engineering,5\nINVALID,Marketing,3\nE002,InvalidDept,2\nE003,HR,15";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1); // Only first row
      expect(result.errors).toHaveLength(3);

      expect(result.errors[0].message).toBe(
        "Employee ID must match pattern E###"
      );
      expect(result.errors[1].message).toBe("Invalid department");
      expect(result.errors[2].message).toBe("Level must be between 1 and 10");
    });

    it("should validate ranges and constraints", () => {
      const parser = new Parser()
        .col("Score", "score", {
          transform: (v) => parseFloat(v),
          validate: (v) =>
            v >= 0 && v <= 100 ? undefined : "Score must be between 0 and 100",
        })
        .col("Grade", "grade", {
          validate: (v) =>
            ["A", "B", "C", "D", "F"].includes(v)
              ? undefined
              : "Grade must be A, B, C, D, or F",
        });

      const csv = "Score,Grade\n95.5,A\n-10,B\n150,C\n85.0,X\n75.0,B";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(2); // First and last rows
      expect(result.errors).toHaveLength(3);
    });
  });

  describe("Missing column errors", () => {
    it("should report missing required columns", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Missing", "missing")
        .col("Optional", "optional", { nullable: true });

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "missing-columns.csv"),
        "utf-8"
      );
      const result = parser.parse(csvContent);

      expect(result.success).toHaveLength(0);
      expect(result.errors).toHaveLength(2); // Two rows, each missing the "Missing" column

      expect(result.errors[0].type).toBe("missing");
      expect(result.errors[0].message).toContain('Column "Missing" not found');
      expect(result.errors[1].type).toBe("missing");
    });

    it("should handle multiple missing columns", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Age", "age")
        .col("Email", "email")
        .col("Phone", "phone");

      const csv = "Name\nJohn\nJane";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(0);
      // Each row should have 3 missing column errors (Age, Email, Phone)
      expect(result.errors).toHaveLength(6);

      const missingColumns = new Set(
        result.errors.map((e) => (e.type !== "row-validation" ? e.column : ""))
      );
      expect(missingColumns).toEqual(new Set(["Age", "Email", "Phone"]));
    });

    it("should not report errors for missing nullable columns", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Age", "age", { nullable: true })
        .col("Email", "email", { nullable: true });

      const csv = "Name\nJohn\nJane";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(2);
      expect(result.errors).toHaveLength(0);

      expect(result.success[0]).toEqual({
        name: "John",
        age: null,
        email: null,
      });
      expect(result.success[1]).toEqual({
        name: "Jane",
        age: null,
        email: null,
      });
    });

    it("should not report errors for missing columns with default values", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Age", "age", { defaultValue: 0 })
        .col("Status", "status", { defaultValue: "active" });

      const csv = "Name\nJohn\nJane";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(2);
      expect(result.errors).toHaveLength(0);

      expect(result.success[0]).toEqual({
        name: "John",
        age: 0,
        status: "active",
      });
    });
  });

  describe("Error reporting details", () => {
    it("should provide detailed error information", () => {
      const parser = new Parser().col("Name", "name").col("Age", "age", {
        transform: (v) => parseInt(v),
        validate: (v) => (v >= 0 ? undefined : "Age cannot be negative"),
      });

      const csv = "Name,Age\nJohn,30\nJane,-5";
      const result = parser.parse(csv);

      expect(result.errors).toHaveLength(1);

      const error = result.errors[0];
      expect(error.row).toBe(1); // 0-indexed
      expect(error.type).toBe("validation");
      if (error.type !== "row-validation") {
        expect(error.column).toBe("Age");
      }
      expect(error.property).toBe("age");
      expect(error.value).toBe("-5");
      expect(error.message).toBe("Age cannot be negative");
    });

    it("should report correct row numbers for multiple errors", () => {
      const parser = new Parser()
        .col("Name", "name", {
          validate: (v) => (v.length > 0 ? undefined : "Name is required"),
        })
        .col("Score", "score", {
          transform: (v) => parseInt(v),
          validate: (v) => (v >= 0 ? undefined : "Score must be non-negative"),
        });

      const csv = "Name,Score\nJohn,95\n,-10\nJane,-5\n,80";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1); // Only John
      expect(result.errors).toHaveLength(4);

      // Row 1 errors (empty name, negative score)
      expect(result.errors.filter((e) => e.row === 1)).toHaveLength(2);
      // Row 2 errors (negative score)
      expect(result.errors.filter((e) => e.row === 2)).toHaveLength(1);
      // Row 3 errors (empty name)
      expect(result.errors.filter((e) => e.row === 3)).toHaveLength(1);
    });

    it("should distinguish between different error types", () => {
      const parser = new Parser().col("Name", "name").col("Data", "data", {
        transform: (v) => {
          if (v === "error") throw new Error("Transform error");
          return v;
        },
        validate: (v) => (v !== "invalid" ? undefined : "Validation error"),
      });

      const csv = "Name,Data\nJohn,valid\nJane,error\nBob,invalid";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(result.errors).toHaveLength(2);

      const transformError = result.errors.find((e) => e.type === "transform");
      const validationError = result.errors.find(
        (e) => e.type === "validation"
      );

      expect(transformError).toBeDefined();
      expect(transformError!.message).toBe("Transform error");

      expect(validationError).toBeDefined();
      expect(validationError!.message).toBe("Validation error");
    });
  });

  describe("Error recovery and continuation", () => {
    it("should continue processing after errors", () => {
      const parser = new Parser().col("Name", "name").col("Age", "age", {
        transform: (v) => parseInt(v),
        validate: (v) => (v >= 0 ? undefined : "Age must be non-negative"),
      });

      const csv = "Name,Age\nJohn,30\nJane,-5\nBob,25\nAlice,-10\nCharlie,35";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(3); // John, Bob, Charlie
      expect(result.errors).toHaveLength(2); // Jane, Alice

      expect(result.success.map((r) => r.name)).toEqual([
        "John",
        "Bob",
        "Charlie",
      ]);
    });

    it("should handle partial row failures", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Age", "age", {
          transform: (v) => parseInt(v),
          validate: (v) => (v >= 0 ? undefined : "Age must be non-negative"),
        })
        .col("Email", "email", {
          validate: (v) => (v.includes("@") ? undefined : "Invalid email"),
        });

      const csv =
        "Name,Age,Email\nJohn,30,john@example.com\nJane,-5,jane@example.com\nBob,25,invalid-email\nAlice,-10,invalid";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1); // Only John
      expect(result.errors).toHaveLength(4); // Jane (age), Bob (email), Alice (age + email)
    });

    it("should process all rows even with early errors", () => {
      const parser = new Parser()
        .col("ID", "id", {
          validate: (v) =>
            v.startsWith("ID") ? undefined : "ID must start with 'ID'",
        })
        .col("Value", "value", {
          transform: (v) => parseInt(v),
        });

      const csv = "ID,Value\nBAD,100\nID001,200\nWRONG,300\nID002,400";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(2); // ID001, ID002
      expect(result.errors).toHaveLength(2); // BAD, WRONG

      // Verify all rows were processed
      expect(result.success[0].id).toBe("ID001");
      expect(result.success[1].id).toBe("ID002");
    });
  });

  describe("Complex error scenarios", () => {
    it("should handle errors in complex nested data", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Settings", "settings", {
          transform: (v) => {
            const parsed = JSON.parse(v);
            if (!parsed.hasOwnProperty("theme")) {
              throw new Error("Settings must include theme property");
            }
            return parsed;
          },
        });

      const csv =
        'Name,Settings\nJohn,"{""theme"": ""dark""}"\nJane,"{""color"": ""blue""}"\nBob,"invalid-json"';
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(result.errors).toHaveLength(2);

      expect(result.errors[0].message).toBe(
        "Settings must include theme property"
      );
      expect(result.errors[1].message).toContain("JSON");
    });

    it("should handle cascading validation errors", () => {
      const parser = new Parser()
        .col("StartDate", "startDate", {
          transform: (v) => new Date(v),
          validate: (v) =>
            !isNaN(v.getTime()) ? undefined : "Invalid start date",
        })
        .col("EndDate", "endDate", {
          transform: (v) => new Date(v),
          validate: (v) =>
            !isNaN(v.getTime()) ? undefined : "Invalid end date",
        })
        .col("Duration", "duration", {
          transform: (v) => parseInt(v),
          validate: (v) => (v > 0 ? undefined : "Duration must be positive"),
        });

      const csv =
        "StartDate,EndDate,Duration\n2024-01-01,2024-01-10,9\ninvalid-date,2024-02-01,5\n2024-03-01,invalid-date,-3";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(result.errors).toHaveLength(3);
    });
  });
});
