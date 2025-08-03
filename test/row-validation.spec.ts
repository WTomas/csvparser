import { Parser } from "../src";

describe("Row Validation", () => {
  describe("Basic row validation", () => {
    it("should validate rows after column transformations", () => {
      const parser = new Parser()
        .col("Price", "price", { transform: (v) => parseFloat(v) })
        .col("Quantity", "quantity", { transform: (v) => parseInt(v) })
        .col("Total", "total", { transform: (v) => parseFloat(v) })
        .val((row) => {
          const expectedTotal = row.price * row.quantity;
          if (Math.abs(expectedTotal - row.total) > 0.01) {
            return `Total mismatch: expected ${expectedTotal}, got ${row.total}`;
          }
          return undefined;
        });

      const csv = "Price,Quantity,Total\n10.00,2,20.00\n15.00,3,40.00";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(result.success[0]).toEqual({ price: 10, quantity: 2, total: 20 });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("row-validation");
      expect(result.errors[0].message).toBe(
        "Total mismatch: expected 45, got 40"
      );
      expect(result.errors[0].row).toBe(3);
      expect(result.errors[0]["column"]).toBeUndefined();
    });

    it("should pass when row validation succeeds", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Age", "age", { transform: (v) => parseInt(v) })
        .val((row) => {
          if (row.age < 0) {
            return "Age cannot be negative";
          }
          return undefined;
        });

      const csv = "Name,Age\nJohn,30\nJane,25";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(2);
      expect(result.success[0]).toEqual({ name: "John", age: 30 });
      expect(result.success[1]).toEqual({ name: "Jane", age: 25 });
    });

    it("should fail when row validation returns error", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Age", "age", { transform: (v) => parseInt(v) })
        .val((row) => {
          if (row.age > 100) {
            return "Age cannot exceed 100";
          }
          return undefined;
        });

      const csv = "Name,Age\nJohn,30\nJane,150";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("row-validation");
      expect(result.errors[0].message).toBe("Age cannot exceed 100");
      expect(result.errors[0].row).toBe(3);
    });
  });

  describe("Multiple validators", () => {
    it("should run multiple validators on each row", () => {
      const parser = new Parser()
        .col("Price", "price", { transform: (v) => parseFloat(v) })
        .col("Tax", "tax", { transform: (v) => parseFloat(v) })
        .col("Total", "total", { transform: (v) => parseFloat(v) })
        .val((row) => {
          if (row.price < 0) {
            return "Price must be positive";
          }
          return undefined;
        })
        .val((row) => {
          const expectedTotal = row.price + row.tax;
          if (Math.abs(expectedTotal - row.total) > 0.01) {
            return `Total should be ${expectedTotal}`;
          }
          return undefined;
        });

      const csv = "Price,Tax,Total\n100,10,110\n-50,5,45\n200,20,215";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1); // Only first row passes all validations
      expect(result.errors).toHaveLength(3); // Second row has 2 errors, third row has 1

      // Second row errors
      const row1Errors = result.errors.filter((e) => e.row === 3);
      expect(row1Errors).toHaveLength(2);
      expect(row1Errors[0].message).toBe("Price must be positive");
      expect(row1Errors[1].message).toBe("Total should be -45");

      // Third row error
      const row2Errors = result.errors.filter((e) => e.row === 4);
      expect(row2Errors).toHaveLength(1);
      expect(row2Errors[0].message).toBe("Total should be 220");
    });

    it("should collect all validator errors for a row", () => {
      const parser = new Parser()
        .col("Value", "value", { transform: (v) => parseInt(v) })
        .val(() => "Error 1")
        .val(() => "Error 2")
        .val(() => "Error 3");

      const csv = "Value\n10";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(0);
      expect(result.errors).toHaveLength(3);
      expect(result.errors.map((e) => e.message)).toEqual([
        "Error 1",
        "Error 2",
        "Error 3",
      ]);
      expect(result.errors.every((e) => e.type === "row-validation")).toBe(
        true
      );
    });
  });

  describe("Integration with column validation", () => {
    it("should not run row validators if column validation fails", () => {
      let validatorCalled = false;
      const parser = new Parser()
        .col("Email", "email", {
          validate: (v) => (v.includes("@") ? undefined : "Invalid email"),
        })
        .val(() => {
          validatorCalled = true;
          return undefined;
        });

      const csv = "Email\ninvalid-email";
      const result = parser.parse(csv);

      expect(validatorCalled).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("validation");
      expect(result.errors[0].message).toBe("Invalid email");
    });

    it("should not run row validators if transformation fails", () => {
      let validatorCalled = false;
      const parser = new Parser()
        .col("Data", "data", {
          transform: (v) => {
            if (v === "bad") throw new Error("Transform failed");
            return v;
          },
        })
        .val(() => {
          validatorCalled = true;
          return undefined;
        });

      const csv = "Data\nbad";
      const result = parser.parse(csv);

      expect(validatorCalled).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("transform");
    });

    it("should not run row validators if required field is missing", () => {
      let validatorCalled = false;
      const parser = new Parser({ skipEmptyLines: false })
        .col("Required", "required")
        .col("Other", "other", { nullable: true })
        .val(() => {
          validatorCalled = true;
          return undefined;
        });

      const csv = "Required,Other\n,"; // Empty required field
      const result = parser.parse(csv);

      expect(validatorCalled).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("validation");
      expect(result.errors[0].message).toBe("Required field is empty");
    });
  });

  describe("Complex validation scenarios", () => {
    it("should validate cross-field relationships", () => {
      const parser = new Parser()
        .col("StartDate", "startDate", { transform: (v) => new Date(v) })
        .col("EndDate", "endDate", { transform: (v) => new Date(v) })
        .val((row) => {
          if (row.endDate < row.startDate) {
            return "End date must be after start date";
          }
          return undefined;
        });

      const csv =
        "StartDate,EndDate\n2024-01-01,2024-12-31\n2024-12-01,2024-06-01";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe(
        "End date must be after start date"
      );
    });

    it("should validate conditional rules based on other fields", () => {
      const parser = new Parser()
        .col("Type", "type")
        .col("Value", "value", { transform: (v) => parseFloat(v) })
        .col("Discount", "discount", {
          transform: (v) => parseFloat(v),
          nullable: true,
        })
        .val((row) => {
          if (
            row.type === "PREMIUM" &&
            (row.discount === null || row.discount < 10)
          ) {
            return "Premium items must have at least 10% discount";
          }
          if (
            row.type === "REGULAR" &&
            row.discount !== null &&
            row.discount > 5
          ) {
            return "Regular items cannot have more than 5% discount";
          }
          return undefined;
        });

      const csv =
        "Type,Value,Discount\nPREMIUM,100,15\nPREMIUM,200,5\nREGULAR,50,3\nREGULAR,75,10";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(2); // First and third rows
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].message).toBe(
        "Premium items must have at least 10% discount"
      );
      expect(result.errors[1].message).toBe(
        "Regular items cannot have more than 5% discount"
      );
    });

    it("should validate business rules with complex calculations", () => {
      const parser = new Parser()
        .col("BasePrice", "basePrice", { transform: (v) => parseFloat(v) })
        .col("TaxRate", "taxRate", { transform: (v) => parseFloat(v) })
        .col("ShippingCost", "shippingCost", {
          transform: (v) => parseFloat(v),
        })
        .col("FinalPrice", "finalPrice", { transform: (v) => parseFloat(v) })
        .val((row) => {
          const calculatedTax = row.basePrice * (row.taxRate / 100);
          const expectedFinal =
            row.basePrice + calculatedTax + row.shippingCost;
          const difference = Math.abs(expectedFinal - row.finalPrice);

          if (difference > 0.01) {
            return `Final price calculation error: expected ${expectedFinal.toFixed(
              2
            )}, got ${row.finalPrice}`;
          }
          return undefined;
        });

      const csv =
        "BasePrice,TaxRate,ShippingCost,FinalPrice\n100,10,5,115\n200,8,10,226\n150,12,8,175";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain(
        "Final price calculation error"
      );
      expect(result.errors[0].message).toContain("expected 176.00");
    });
  });

  describe("Type safety", () => {
    it("should provide correctly typed row to validator", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Age", "age", { transform: (v) => parseInt(v) })
        .col("Active", "active", { transform: (v) => v === "true" })
        .col("Tags", "tags", {
          transform: (v) => v.split(",").map((s) => s.trim()),
        })
        .val((row) => {
          // TypeScript should infer the correct types
          const _name: string = row.name;
          const _age: number = row.age;
          const _active: boolean = row.active;
          const _tags: string[] = row.tags;

          // Use the variables to avoid unused variable warnings
          void _name;
          void _age;
          void _active;
          void _tags;

          // Type-safe property access
          if (row.tags.includes("admin") && row.age < 18) {
            return "Admin users must be 18 or older";
          }
          return undefined;
        });

      const csv =
        'Name,Age,Active,Tags\nJohn,25,true,"user,admin"\nJane,16,true,"user,admin"';
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Admin users must be 18 or older");
    });

    it("should handle nullable fields in type-safe manner", () => {
      const parser = new Parser()
        .col("Name", "name")
        .col("Email", "email", { nullable: true })
        .col("Phone", "phone", { nullable: true })
        .val((row) => {
          // TypeScript knows email and phone can be null
          if (row.email === null && row.phone === null) {
            return "At least one contact method is required";
          }
          return undefined;
        });

      const csv =
        "Name,Email,Phone\nJohn,john@example.com,\nJane,,555-1234\nBob,,";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe(
        "At least one contact method is required"
      );
    });
  });

  describe("Error reporting", () => {
    it("should provide correct error structure for row validation", () => {
      const parser = new Parser()
        .col("Value", "value", { transform: (v) => parseInt(v) })
        .val((row) => `Value ${row.value} is invalid`);

      const csv = "Value\n42";
      const result = parser.parse(csv);

      expect(result.errors).toHaveLength(1);
      const error = result.errors[0];

      expect(error.type).toBe("row-validation");
      expect(error.row).toBe(2);
      expect(error["column"]).toBeUndefined();
      expect(error.property).toBe("_row");
      expect(error.value).toBe(JSON.stringify({ value: 42 }));
      expect(error.message).toBe("Value 42 is invalid");
    });

    it("should report multiple row validation errors correctly", () => {
      const parser = new Parser()
        .col("A", "a", { transform: (v) => parseInt(v) })
        .col("B", "b", { transform: (v) => parseInt(v) })
        .val((row) => (row.a > 10 ? "A is too large" : undefined))
        .val((row) => (row.b < 5 ? "B is too small" : undefined));

      const csv = "A,B\n15,3\n8,7";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1);
      expect(result.errors).toHaveLength(2);

      expect(result.errors[0].message).toBe("A is too large");
      expect(result.errors[0].row).toBe(2);

      expect(result.errors[1].message).toBe("B is too small");
      expect(result.errors[1].row).toBe(2);
    });

    it("should handle mixed column and row validation errors", () => {
      const parser = new Parser()
        .col("Email", "email", {
          validate: (v) => (v.includes("@") ? undefined : "Invalid email"),
        })
        .col("Age", "age", {
          transform: (v) => parseInt(v),
          validate: (v) => (v >= 0 ? undefined : "Age must be positive"),
        })
        .val((row) => {
          if (row.age > 100) {
            return "Age seems unrealistic";
          }
          return undefined;
        });

      const csv =
        "Email,Age\ninvalid,-5\nvalid@example.com,150\nok@test.com,30";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(1); // Only last row succeeds
      expect(result.errors).toHaveLength(3);

      // First row has column validation errors only (no row validation runs)
      const row0Errors = result.errors.filter((e) => e.row === 2);
      expect(row0Errors).toHaveLength(2);
      expect(row0Errors.every((e) => e.type === "validation")).toBe(true);

      // Second row has row validation error
      const row1Errors = result.errors.filter((e) => e.row === 3);
      expect(row1Errors).toHaveLength(1);
      expect(row1Errors[0].type).toBe("row-validation");
      expect(row1Errors[0].message).toBe("Age seems unrealistic");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty CSV with row validator", () => {
      const parser = new Parser()
        .col("Value", "value")
        .val(() => "Should not run");

      const csv = "Value"; // Headers only, no data
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.hasErrors).toBe(false);
    });

    it("should handle row validator that always passes", () => {
      const parser = new Parser().col("Value", "value").val(() => undefined); // Always returns undefined (passes)

      const csv = "Value\nA\nB\nC";
      const result = parser.parse(csv);

      expect(result.hasErrors).toBe(false);
      expect(result.success).toHaveLength(3);
    });

    it("should handle row validator with complex return logic", () => {
      const parser = new Parser()
        .col("Status", "status")
        .col("Value", "value", { transform: (v) => parseInt(v) })
        .val((row) => {
          switch (row.status) {
            case "ACTIVE":
              return row.value > 0
                ? undefined
                : "Active items must have positive value";
            case "INACTIVE":
              return row.value === 0
                ? undefined
                : "Inactive items must have zero value";
            case "PENDING":
              return undefined; // No validation for pending
            default:
              return `Unknown status: ${row.status}`;
          }
        });

      const csv =
        "Status,Value\nACTIVE,10\nACTIVE,0\nINACTIVE,0\nINACTIVE,5\nPENDING,100\nUNKNOWN,50";
      const result = parser.parse(csv);

      expect(result.success).toHaveLength(3); // First, third, and fifth rows
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0].message).toBe(
        "Active items must have positive value"
      );
      expect(result.errors[1].message).toBe(
        "Inactive items must have zero value"
      );
      expect(result.errors[2].message).toBe("Unknown status: UNKNOWN");
    });
  });
});
