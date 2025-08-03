import { Parser } from "../src";
import fs from "fs";
import path from "path";

describe("Column Options", () => {
  const fixturesPath = path.join(__dirname, "fixtures");

  describe("Transform functions", () => {
    it("should transform strings to numbers", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Salary", "salary", { transform: (v) => parseFloat(v) });

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "transform-data.csv"),
        "utf-8"
      );
      const result = parser.parse(csvContent);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(3);

      const john = result.success[0];
      expect(typeof john.name).toBe("string");
      expect(typeof john.salary).toBe("number");
      expect(john.salary).toBe(50000.5);
    });

    it("should transform strings to dates", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("BirthDate", "birthDate", {
          transform: (v) => new Date(v),
        });

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "transform-data.csv"),
        "utf-8"
      );
      const result = parser.parse(csvContent);

      expect(result.hasErrors).toBe(false);
      expect(result.success[0].birthDate).toEqual(new Date("1990-05-15"));
      expect(result.success[1].birthDate).toEqual(new Date("1985-12-03"));
    });

    it("should transform strings to booleans", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("IsActive", "isActive", {
          transform: (v) => v.toLowerCase() === "true",
        });

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "transform-data.csv"),
        "utf-8"
      );
      const result = parser.parse(csvContent);

      expect(result.hasErrors).toBe(false);
      expect(result.success[0].isActive).toBe(true);
      expect(result.success[1].isActive).toBe(false);
      expect(result.success[2].isActive).toBe(true);
    });

    it("should transform strings to arrays", () => {
      const parser = new Parser().col("Skills", "skills", {
        transform: (v) => v.split(",").map((s) => s.trim()),
      });

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "employees.csv"),
        "utf-8"
      );
      const result = parser.parse(csvContent);

      expect(result.hasErrors).toBe(false);
      expect(result.success[0].skills).toEqual([
        "JavaScript",
        "TypeScript",
        "React",
      ]);
      expect(result.success[1].skills).toEqual([
        "SEO",
        "Content Marketing",
        "Analytics",
      ]);
    });

    it("should handle complex transforms with custom logic", () => {
      const parser = new Parser().col("Name", "name").col("Score", "grade", {
        transform: (v) => {
          const score = parseFloat(v);
          if (score >= 90) return "A";
          if (score >= 80) return "B";
          if (score >= 70) return "C";
          if (score >= 60) return "D";
          return "F";
        },
      });

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "transform-data.csv"),
        "utf-8"
      );
      const result = parser.parse(csvContent);

      expect(result.hasErrors).toBe(false);
      expect(result.success[0].grade).toBe("A"); // 95.5
      expect(result.success[1].grade).toBe("B"); // 88.2
      expect(result.success[2].grade).toBe("A"); // 92.1
    });

    it("should handle transforms that return different types", () => {
      enum AgeCategory {
        YOUNG = "young",
        MIDDLE = "middle",
        SENIOR = "senior",
      }
      const parser = new Parser()
        .col("Name", "name")
        .col("BirthDate", "ageCategory", {
          transform: (v) => {
            const birthYear = new Date(v).getFullYear();
            const age = new Date().getFullYear() - birthYear;
            return {
              age,
              category:
                age < 30
                  ? AgeCategory.YOUNG
                  : age < 50
                  ? AgeCategory.MIDDLE
                  : AgeCategory.SENIOR,
            };
          },
        });

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "transform-data.csv"),
        "utf-8"
      );
      const result = parser.parse(csvContent);

      expect(result.hasErrors).toBe(false);
      expect(result.success[0].ageCategory).toHaveProperty("age");
      expect(result.success[0].ageCategory).toHaveProperty("category");
      expect(typeof result.success[0].ageCategory.age).toBe("number");
      expect(
        [...Object.values(AgeCategory)].includes(
          result.success[0].ageCategory.category
        )
      ).toBeTruthy();
    });
  });

  describe("Validation functions", () => {
    it("should validate email addresses", () => {
      const parser = new Parser().col("Name", "name").col("Email", "email", {
        validate: (v) =>
          v.includes("@") && v.includes(".")
            ? undefined
            : "Invalid email format",
      });

      const csv =
        "Name,Email\nJohn,john@example.com\nJane,invalid-email\nBob,bob@test.org";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Invalid email format");
      expect(result.errors[0].row).toBe(3); // Jane's row
    });

    it("should validate age ranges", () => {
      const parser = new Parser().col("Name", "name").col("Age", "age", {
        transform: (v) => parseInt(v),
        validate: (v) =>
          v >= 0 && v <= 120 ? undefined : "Age must be between 0 and 120",
      });

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "users-with-errors.csv"),
        "utf-8"
      );
      const result = parser.parse(csvContent);

      expect(result.success).toHaveLength(2); // John and Bob
      expect(result.errors.length).toBeGreaterThan(0);

      const ageErrors = result.errors.filter((e) =>
        e.message.includes("Age must be")
      );
      expect(ageErrors).toHaveLength(2); // Jane (-5) and Bob (150)
    });

    it("should validate salary ranges", () => {
      const parser = new Parser().col("Name", "name").col("Salary", "salary", {
        transform: (v) => parseFloat(v),
        validate: (v) => (v > 0 ? undefined : "Salary must be positive"),
      });

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "users-with-errors.csv"),
        "utf-8"
      );
      const result = parser.parse(csvContent);

      const salaryErrors = result.errors.filter((e) =>
        e.message.includes("Salary must be")
      );
      expect(salaryErrors).toHaveLength(2); // Alice with -1000 and Jane with ABC
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
        });

      const csv =
        "Employee ID,Department\nE001,Engineering\nINVALID,Marketing\nE002,InvalidDept";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].message).toBe(
        "Employee ID must match pattern E###"
      );
      expect(result.errors[1].message).toBe("Invalid department");
    });

    it("should validate transformed values", () => {
      const parser = new Parser().col("Score", "score", {
        transform: (v) => parseFloat(v),
        validate: (score) => {
          if (isNaN(score)) return "Score must be a valid number";
          if (score < 0 || score > 100)
            return "Score must be between 0 and 100";
          return undefined;
        },
      });

      const csv = "Score\n95.5\nInvalidNumber\n150\n-10\n85.0";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(2); // 95.5 and 85.0
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0].message).toBe("Score must be a valid number");
      expect(result.errors[1].message).toBe("Score must be between 0 and 100");
      expect(result.errors[2].message).toBe("Score must be between 0 and 100");
    });
  });

  describe("Nullable fields", () => {
    it("should handle nullable string fields", () => {
      const parser = new Parser()
        .col("Product", "product")
        .col("Category", "category", { nullable: true })
        .col("Description", "description", { nullable: true });

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "products-with-nulls.csv"),
        "utf-8"
      );
      const result = parser.parse(csvContent);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(4);

      // Mouse has empty category
      expect(result.success[1].category).toBeNull();

      // Keyboard has empty description
      expect(result.success[2].description).toBeNull();

      // Monitor has all fields
      expect(result.success[3].category).toBe("Electronics");
      expect(result.success[3].description).toBe("24-inch LED monitor");
    });

    it("should handle nullable transformed fields", () => {
      const parser = new Parser()
        .col("Product", "product")
        .col("Price", "price", {
          transform: (v) => parseFloat(v),
          nullable: true,
        });

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "products-with-nulls.csv"),
        "utf-8"
      );
      const result = parser.parse(csvContent);

      expect(result.hasErrors).toBe(false);
      expect(result.success[0].price).toBe(999.99);
      expect(result.success[1].price).toBe(29.99);
      expect(result.success[2].price).toBeNull(); // Keyboard has empty price
      expect(result.success[3].price).toBe(299.99);
    });

    it("should validate nullable fields only when not null", () => {
      const parser = new Parser().col("Name", "name").col("Email", "email", {
        nullable: true,
        validate: (v) => (v.includes("@") ? undefined : "Invalid email format"),
      });

      const csv = "Name,Email\nJohn,john@example.com\nJane,\nBob,invalid-email";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(2); // John and Jane
      expect(result.success[1].email).toBeNull(); // Jane's email is null
      expect(result.errors).toHaveLength(1); // Bob's invalid email
      expect(result.errors[0].message).toBe("Invalid email format");
    });

    it("should correctly type nullable fields", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Age", "age", {
          transform: (v) => parseInt(v),
          nullable: true,
        })
        .col("Email", "email", { nullable: true });

      const csv = "Name,Age,Email\nJohn,30,john@example.com\nJane,,";
      const result = parser.parse(csv);

      // Compile-time type checking
      const record = result.success[0];
      const name: string = record.name;
      const age: number | null = record.age;
      const email: string | null = record.email;

      expect(typeof name).toBe("string");
      expect(typeof age).toBe("number");
      expect(email).toBe("john@example.com");

      // Second record has nulls
      expect(result.success[1].age).toBeNull();
      expect(result.success[1].email).toBeNull();
    });
  });

  describe("Default values", () => {
    it("should use default values for empty fields", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Age", "age", {
          transform: (v) => parseInt(v),
          defaultValue: 0,
        })
        .col("Status", "status", {
          defaultValue: "inactive",
        });

      const csv = "Name,Age,Status\nJohn,,\nJane,25,active\nBob,30,";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(3);

      expect(result.success[0]).toEqual({
        name: "John",
        age: 0,
        status: "inactive",
      });
      expect(result.success[1]).toEqual({
        name: "Jane",
        age: 25,
        status: "active",
      });
      expect(result.success[2]).toEqual({
        name: "Bob",
        age: 30,
        status: "inactive",
      });
    });

    it("should use default values for missing columns", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Score", "score", {
          transform: (v) => parseInt(v),
          defaultValue: 0,
        })
        .col("Active", "active", {
          defaultValue: true,
        });

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "missing-columns.csv"),
        "utf-8"
      );
      const result = parser.parse(csvContent);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);

      expect(result.success[0]).toEqual({
        name: "John Doe",
        score: 0,
        active: true,
      });
      expect(result.success[1]).toEqual({
        name: "Jane Smith",
        score: 0,
        active: true,
      });
    });

    it("should prefer actual values over defaults", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Priority", "priority", {
          defaultValue: "low",
        })
        .col("Score", "score", {
          transform: (v) => parseInt(v),
          defaultValue: 0,
        });

      const csv = "Name,Priority,Score\nJohn,high,95\nJane,,\nBob,medium,85";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(3);

      expect(result.success[0]).toEqual({
        name: "John",
        priority: "high",
        score: 95,
      });
      expect(result.success[1]).toEqual({
        name: "Jane",
        priority: "low",
        score: 0,
      });
      expect(result.success[2]).toEqual({
        name: "Bob",
        priority: "medium",
        score: 85,
      });
    });

    it("should handle complex default values", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Settings", "settings", {
          transform: (v) => JSON.parse(v),
          defaultValue: { theme: "light", notifications: true },
        })
        .col("Tags", "tags", {
          transform: (v) => v.split(",").map((s) => s.trim()),
          defaultValue: [],
        });

      const csv =
        'Name,Settings,Tags\nJohn,"{""theme"":""dark""}","work,urgent"\nJane,,';
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);

      expect(result.success[0].settings).toEqual({ theme: "dark" });
      expect(result.success[0].tags).toEqual(["work", "urgent"]);

      expect(result.success[1].settings).toEqual({
        theme: "light",
        notifications: true,
      });
      expect(result.success[1].tags).toEqual([]);
    });
  });

  describe("Multiple column names (aliases)", () => {
    it("should match any of the provided column names", () => {
      const parser = new Parser()
        .col(["Full Name", "Name", "full_name"], "name")
        .col(["Years", "Age", "years_old"], "age", {
          transform: (v) => parseInt(v),
        })
        .col(["Contact Email", "Email", "email_address"], "email");

      const csvContent = fs.readFileSync(
        path.join(fixturesPath, "alias-columns.csv"),
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

    it("should prioritize exact matches in alias arrays", () => {
      const parser = new Parser().col(["name", "Name", "FULL_NAME"], "name");

      // Test different CSV headers that match aliases
      const csv1 = "name,age\nJohn,30";
      const csv2 = "Name,age\nJane,25";
      const csv3 = "FULL_NAME,age\nBob,35";

      const result1 = parser.parse(csv1);
      const result2 = parser.parse(csv2);
      const result3 = parser.parse(csv3);

      expect(result1.success[0]).toEqual({ name: "John" });
      expect(result2.success[0]).toEqual({ name: "Jane" });
      expect(result3.success[0]).toEqual({ name: "Bob" });
    });

    it("should handle aliases with transforms and validation", () => {
      const parser = new Parser().col(
        ["salary", "Salary", "annual_salary"],
        "salary",
        {
          transform: (v) => parseFloat(v),
          validate: (v) => (v > 0 ? undefined : "Salary must be positive"),
        }
      );

      const csv1 = "salary\n50000.50";
      const csv2 = "Salary\n75000.75";
      const csv3 = "annual_salary\n-1000";

      const result1 = parser.parse(csv1);
      const result2 = parser.parse(csv2);
      const result3 = parser.parse(csv3);

      expect(result1.success[0].salary).toBe(50000.5);
      expect(result2.success[0].salary).toBe(75000.75);
      expect(result3.errors[0].message).toBe("Salary must be positive");
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

    it("should not trim when trim option is false", () => {
      const parser = new Parser()
        .col("Name", "name", { trim: false })
        .col("Email", "email");

      const csv = "Name,Email\n  John Doe  ,  jane@example.com  ";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success[0].name).toBe("  John Doe  ");
      expect(result.success[0].email).toBe("jane@example.com"); // Still trimmed due to parser default
    });

    it("should handle trim with transforms", () => {
      const parser = new Parser().col("Score", "score", {
        trim: false,
        transform: (v) => v.length, // Get length including whitespace
      });

      const csv = "Score\n  95  \n100";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success[0].score).toBe(6); // "  95  ".length
      expect(result.success[1].score).toBe(3); // "100".length
    });
  });

  describe("Multiple column aliases", () => {
    it("should map to the correct column alias in the error", () => {
      const parser = new Parser().col(
        ["First name", "Given name"],
        "firstName",
        {
          validate: (v) => (v.length > 0 ? undefined : "Name cannot be empty"),
        }
      );

      const csv = "Given name,Last name\n,";
      const result = parser.parse(csv);
      console.log(result);

      expect(result.hasErrors).toBe(true);
      expect(result.errors[0].type).toBe("validation");
      expect(result.errors[0].row).toBe(2);
      if (result.errors[0].type === "validation") {
        expect(result.errors[0].property).toBe("firstName");
        expect(result.errors[0].column).toBe("Given name"); // Maps to column from CSV
      }
    });
  });
});
