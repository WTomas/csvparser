import { parseCSV } from "../src/csv-tokenizer";

describe("CSV Tokenizer", () => {
  describe("Basic CSV parsing", () => {
    it("should parse simple CSV with headers and rows", () => {
      const csv = "Name,Age,City\nJohn,30,NYC\nJane,25,LA";
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name", "Age", "City"]);
      expect(result.rows).toEqual([
        ["John", "30", "NYC"],
        ["Jane", "25", "LA"]
      ]);
    });

    it("should handle single column CSV", () => {
      const csv = "Name\nJohn\nJane";
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name"]);
      expect(result.rows).toEqual([["John"], ["Jane"]]);
    });

    it("should handle single row CSV", () => {
      const csv = "Name,Age\nJohn,30";
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name", "Age"]);
      expect(result.rows).toEqual([["John", "30"]]);
    });

    it("should handle headers only CSV", () => {
      const csv = "Name,Age,City";
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name", "Age", "City"]);
      expect(result.rows).toEqual([]);
    });

    it("should handle empty CSV", () => {
      const csv = "";
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual([]);
      expect(result.rows).toEqual([]);
    });
  });

  describe("Empty fields and whitespace", () => {
    it("should handle empty fields", () => {
      const csv = "Name,Age,City\nJohn,,NYC\n,25,\nJane,30,LA";
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name", "Age", "City"]);
      expect(result.rows).toEqual([
        ["John", "", "NYC"],
        ["", "25", ""],
        ["Jane", "30", "LA"]
      ]);
    });

    it("should handle fields with only whitespace", () => {
      const csv = "Name,Age\n   ,  \nJohn,30";
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name", "Age"]);
      expect(result.rows).toEqual([
        ["   ", "  "],
        ["John", "30"]
      ]);
    });

    it("should handle trailing empty fields", () => {
      const csv = "A,B,C,\nvalue1,value2,value3,\ntest,,value,";
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["A", "B", "C", ""]);
      expect(result.rows).toEqual([
        ["value1", "value2", "value3", ""],
        ["test", "", "value", ""]
      ]);
    });
  });

  describe("Line endings", () => {
    it("should handle CRLF line endings", () => {
      const csv = "Name,Age\r\nJohn,30\r\nJane,25";
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name", "Age"]);
      expect(result.rows).toEqual([
        ["John", "30"],
        ["Jane", "25"]
      ]);
    });

    it("should handle LF line endings", () => {
      const csv = "Name,Age\nJohn,30\nJane,25";
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name", "Age"]);
      expect(result.rows).toEqual([
        ["John", "30"],
        ["Jane", "25"]
      ]);
    });

    it("should handle mixed line endings", () => {
      const csv = "Name,Age\r\nJohn,30\nJane,25\r\nBob,35";
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name", "Age"]);
      expect(result.rows).toEqual([
        ["John", "30"],
        ["Jane", "25"],
        ["Bob", "35"]
      ]);
    });

    it("should handle file without final newline", () => {
      const csv = "Name,Age\nJohn,30\nJane,25";
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name", "Age"]);
      expect(result.rows).toEqual([
        ["John", "30"],
        ["Jane", "25"]
      ]);
    });
  });

  describe("Quoted fields", () => {
    it("should handle basic quoted fields", () => {
      const csv = 'Name,Description\n"John Doe","A person"\n"Jane Smith","Another person"';
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name", "Description"]);
      expect(result.rows).toEqual([
        ["John Doe", "A person"],
        ["Jane Smith", "Another person"]
      ]);
    });

    it("should handle quoted fields with commas", () => {
      const csv = 'Name,Description\n"Doe, John","A person, with comma"\n"Smith, Jane","Another, person"';
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name", "Description"]);
      expect(result.rows).toEqual([
        ["Doe, John", "A person, with comma"],
        ["Smith, Jane", "Another, person"]
      ]);
    });

    it("should handle quoted fields with newlines", () => {
      const csv = 'Name,Description\n"John","Line 1\nLine 2"\n"Jane","Single line"';
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name", "Description"]);
      expect(result.rows).toEqual([
        ["John", "Line 1\nLine 2"],
        ["Jane", "Single line"]
      ]);
    });

    it("should handle escaped quotes (double quotes)", () => {
      const csv = 'Name,Quote\n"John","He said ""Hello"""\n"Jane","She said ""Hi there"""';
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name", "Quote"]);
      expect(result.rows).toEqual([
        ["John", 'He said "Hello"'],
        ["Jane", 'She said "Hi there"']
      ]);
    });

    it("should handle mixed quoted and unquoted fields", () => {
      const csv = 'Name,Age,"City",Country\nJohn,30,"New York",USA\n"Jane Doe",25,London,UK';
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name", "Age", "City", "Country"]);
      expect(result.rows).toEqual([
        ["John", "30", "New York", "USA"],
        ["Jane Doe", "25", "London", "UK"]
      ]);
    });

    it("should handle empty quoted fields", () => {
      const csv = 'Name,Description,Notes\n"John","","Some notes"\n"","Empty name",""';
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name", "Description", "Notes"]);
      expect(result.rows).toEqual([
        ["John", "", "Some notes"],
        ["", "Empty name", ""]
      ]);
    });

    it("should handle quotes at the beginning of unquoted fields", () => {
      const csv = 'Name,Description\nJohn,"quotes at start\n"Jane,normal field';
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name", "Description"]);
      // When a quote starts a field, it continues until the closing quote
      // The newline and "Jane become part of the quoted field
      expect(result.rows).toEqual([
        ["John", "quotes at start\nJane", "normal field"]
      ]);
    });

    it("should handle quotes in the middle of unquoted fields", () => {
      const csv = 'Name,Description\nJohn,He said "hello" to me\nJane,She replied "hi"';
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name", "Description"]);
      expect(result.rows).toEqual([
        ["John", 'He said "hello" to me'],
        ["Jane", 'She replied "hi"']
      ]);
    });
  });

  describe("Custom delimiters", () => {
    it("should handle semicolon delimiter", () => {
      const csv = "Name;Age;City\nJohn;30;NYC\nJane;25;LA";
      const result = parseCSV(csv, { delimiter: ";" });

      expect(result.headers).toEqual(["Name", "Age", "City"]);
      expect(result.rows).toEqual([
        ["John", "30", "NYC"],
        ["Jane", "25", "LA"]
      ]);
    });

    it("should handle tab delimiter", () => {
      const csv = "Name\tAge\tCity\nJohn\t30\tNYC\nJane\t25\tLA";
      const result = parseCSV(csv, { delimiter: "\t" });

      expect(result.headers).toEqual(["Name", "Age", "City"]);
      expect(result.rows).toEqual([
        ["John", "30", "NYC"],
        ["Jane", "25", "LA"]
      ]);
    });

    it("should handle pipe delimiter", () => {
      const csv = "Name|Age|City\nJohn|30|NYC\nJane|25|LA";
      const result = parseCSV(csv, { delimiter: "|" });

      expect(result.headers).toEqual(["Name", "Age", "City"]);
      expect(result.rows).toEqual([
        ["John", "30", "NYC"],
        ["Jane", "25", "LA"]
      ]);
    });

    it("should handle custom delimiter with quoted fields", () => {
      const csv = 'Name;Description\n"Doe; John";"A person; with semicolon"\n"Smith; Jane";"Another; person"';
      const result = parseCSV(csv, { delimiter: ";" });

      expect(result.headers).toEqual(["Name", "Description"]);
      expect(result.rows).toEqual([
        ["Doe; John", "A person; with semicolon"],
        ["Smith; Jane", "Another; person"]
      ]);
    });
  });

  describe("Custom quote characters", () => {
    it("should handle single quote as quote character", () => {
      const csv = "Name,Description\n'John Doe','A person'\n'Jane Smith','Another person'";
      const result = parseCSV(csv, { quote: "'" });

      expect(result.headers).toEqual(["Name", "Description"]);
      expect(result.rows).toEqual([
        ["John Doe", "A person"],
        ["Jane Smith", "Another person"]
      ]);
    });

    it("should handle custom quote with escaped quotes", () => {
      const csv = "Name,Quote\n'John','He said ''Hello'''\n'Jane','She said ''Hi'''";
      const result = parseCSV(csv, { quote: "'", escape: "'" });

      expect(result.headers).toEqual(["Name", "Quote"]);
      expect(result.rows).toEqual([
        ["John", "He said 'Hello'"],
        ["Jane", "She said 'Hi'"]
      ]);
    });
  });

  describe("Custom escape characters", () => {
    it("should handle backslash as escape character", () => {
      const csv = 'Name,Quote\n"John","He said \\"Hello\\""\n"Jane","She said \\"Hi\\""';
      const result = parseCSV(csv, { escape: "\\" });

      expect(result.headers).toEqual(["Name", "Quote"]);
      expect(result.rows).toEqual([
        ["John", 'He said "Hello"'],
        ["Jane", 'She said "Hi"']
      ]);
    });

    it("should handle different quote and escape characters", () => {
      const csv = "Name,Quote\n'John','He said \\'Hello\\''\n'Jane','She said \\'Hi\\''";
      const result = parseCSV(csv, { quote: "'", escape: "\\" });

      expect(result.headers).toEqual(["Name", "Quote"]);
      expect(result.rows).toEqual([
        ["John", "He said 'Hello'"],
        ["Jane", "She said 'Hi'"]
      ]);
    });
  });

  describe("Skip rows option", () => {
    it("should skip specified number of rows", () => {
      const csv = "# This is a comment\n# Another comment\nName,Age\nJohn,30\nJane,25";
      const result = parseCSV(csv, { skipRows: 2 });

      expect(result.headers).toEqual(["Name", "Age"]);
      expect(result.rows).toEqual([
        ["John", "30"],
        ["Jane", "25"]
      ]);
    });

    it("should handle skipRows greater than total rows", () => {
      const csv = "Name,Age\nJohn,30";
      const result = parseCSV(csv, { skipRows: 5 });

      expect(result.headers).toEqual([]);
      expect(result.rows).toEqual([]);
    });

    it("should handle skipRows equal to total rows", () => {
      const csv = "Name,Age\nJohn,30";
      const result = parseCSV(csv, { skipRows: 2 });

      expect(result.headers).toEqual([]);
      expect(result.rows).toEqual([]);
    });
  });

  describe("Skip empty lines option", () => {
    it("should skip empty lines by default", () => {
      const csv = "Name,Age\n\nJohn,30\n\n\nJane,25\n\n";
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name", "Age"]);
      expect(result.rows).toEqual([
        ["John", "30"],
        ["Jane", "25"]
      ]);
    });

    it("should preserve empty lines when skipEmptyLines is false", () => {
      const csv = "Name,Age\n\nJohn,30\n\nJane,25";
      const result = parseCSV(csv, { skipEmptyLines: false });

      expect(result.headers).toEqual(["Name", "Age"]);
      expect(result.rows).toEqual([
        [""],
        ["John", "30"],
        [""],
        ["Jane", "25"]
      ]);
    });

    it("should handle lines with only whitespace", () => {
      const csv = "Name,Age\n   \nJohn,30\n\t\t\nJane,25";
      const result = parseCSV(csv, { skipEmptyLines: true });

      expect(result.headers).toEqual(["Name", "Age"]);
      expect(result.rows).toEqual([
        ["John", "30"],
        ["Jane", "25"]
      ]);
    });

    it("should not skip empty lines within quoted fields", () => {
      const csv = 'Name,Description\n"John","Line 1\n\nLine 3"\n"Jane","Single line"';
      const result = parseCSV(csv, { skipEmptyLines: true });

      expect(result.headers).toEqual(["Name", "Description"]);
      expect(result.rows).toEqual([
        ["John", "Line 1\n\nLine 3"],
        ["Jane", "Single line"]
      ]);
    });
  });

  describe("Complex edge cases", () => {
    it("should handle CSV with inconsistent column counts", () => {
      const csv = "A,B,C\nvalue1,value2\ntest,value,extra,toomany";
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["A", "B", "C"]);
      expect(result.rows).toEqual([
        ["value1", "value2"],
        ["test", "value", "extra", "toomany"]
      ]);
    });

    it("should handle multiline quoted fields spanning many lines", () => {
      const csv = 'Name,Story\n"John","This is\na very\nlong story\nthat spans\nmultiple lines"\n"Jane","Short story"';
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name", "Story"]);
      expect(result.rows).toEqual([
        ["John", "This is\na very\nlong story\nthat spans\nmultiple lines"],
        ["Jane", "Short story"]
      ]);
    });

    it("should handle nested quotes and complex escaping", () => {
      const csv = 'Text\n"He said ""She said \\\"Hello\\\"\"" to me"\n"Simple text"';
      const result = parseCSV(csv, { escape: "\\" });

      expect(result.headers).toEqual(["Text"]);
      // With backslash escape, the \\" becomes literal backslash + quote
      expect(result.rows).toEqual([
        ['He said "She said \\"Hello\\"\"" to me"'],
        ["Simple text"]
      ]);
    });

    it("should handle fields with all special characters", () => {
      const csv = 'Special\n"\\n\\r\\t,;|""\'"\n"Normal text"';
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Special"]);
      // Double quotes ("") in quoted field become single quote (")
      expect(result.rows).toEqual([
        ["\\n\\r\\t,;|\"'"],
        ["Normal text"]
      ]);
    });

    it("should handle Unicode characters", () => {
      const csv = "Name,Emoji,Language\n\"José\",\"🎉\",\"Español\"\n\"François\",\"🇫🇷\",\"Français\"";
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name", "Emoji", "Language"]);
      expect(result.rows).toEqual([
        ["José", "🎉", "Español"],
        ["François", "🇫🇷", "Français"]
      ]);
    });

    it("should handle very long fields", () => {
      const longText = "A".repeat(10000);
      const csv = `Text\n"${longText}"\n"Short"`;
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Text"]);
      expect(result.rows).toEqual([
        [longText],
        ["Short"]
      ]);
    });

    it("should handle fields with only special characters", () => {
      const csv = 'A,B,C\n",",";","\\"\n"\\n","\\r","\\t"';
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["A", "B", "C"]);
      expect(result.rows).toEqual([
        [",", ";", "\\"],
        ["\\n", "\\r", "\\t"]
      ]);
    });
  });

  describe("Malformed CSV handling", () => {
    it("should handle unclosed quotes at end of file", () => {
      const csv = 'Name,Description\n"John","Unclosed quote';
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name", "Description"]);
      expect(result.rows).toEqual([
        ["John", "Unclosed quote"]
      ]);
    });

    it("should handle unclosed quotes with newlines", () => {
      const csv = 'Name,Description\n"John","Unclosed\nwith newlines\nstill unclosed';
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name", "Description"]);
      expect(result.rows).toEqual([
        ["John", "Unclosed\nwith newlines\nstill unclosed"]
      ]);
    });

    it("should handle quotes in the middle of unquoted fields", () => {
      const csv = 'Name,Description\nJo"hn,Description with "quotes" in middle\nJane,Normal field';
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Name", "Description"]);
      expect(result.rows).toEqual([
        ['Jo"hn', 'Description with "quotes" in middle'],
        ["Jane", "Normal field"]
      ]);
    });

    it("should handle mixed quote styles in same field", () => {
      const csv = 'Description\n"Quoted start but no end\n\'Single quotes mixed\'\nNormal text';
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["Description"]);
      expect(result.rows).toEqual([
        ["Quoted start but no end\n'Single quotes mixed'\nNormal text"]
      ]);
    });
  });

  describe("Performance edge cases", () => {
    it("should handle many columns", () => {
      const headers = Array.from({ length: 100 }, (_, i) => `Col${i}`);
      const row = Array.from({ length: 100 }, (_, i) => `Value${i}`);
      const csv = headers.join(",") + "\n" + row.join(",");
      
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(headers);
      expect(result.rows).toEqual([row]);
    });

    it("should handle many rows", () => {
      const headers = "A,B,C";
      const rows = Array.from({ length: 1000 }, (_, i) => `${i},${i*2},${i*3}`);
      const csv = headers + "\n" + rows.join("\n");
      
      const result = parseCSV(csv, {});

      expect(result.headers).toEqual(["A", "B", "C"]);
      expect(result.rows).toHaveLength(1000);
      expect(result.rows[0]).toEqual(["0", "0", "0"]);
      expect(result.rows[999]).toEqual(["999", "1998", "2997"]);
    });
  });

  describe("All options combined", () => {
    it("should handle all options together", () => {
      const csv = "# Comment 1\n# Comment 2\n\nName;Description;Notes\n'John Doe';'A person; with ''special'' chars';\n\n'Jane Smith';'Another person';\n\n";
      const result = parseCSV(csv, {
        delimiter: ";",
        quote: "'",
        escape: "'",
        skipRows: 2,
        skipEmptyLines: true
      });

      expect(result.headers).toEqual(["Name", "Description", "Notes"]);
      expect(result.rows).toEqual([
        ["John Doe", "A person; with 'special' chars", ""],
        ["Jane Smith", "Another person", ""]
      ]);
    });
  });
});