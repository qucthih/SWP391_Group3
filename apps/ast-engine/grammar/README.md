# Grammar Java

Nguồn: https://github.com/antlr/grammars-v4/tree/master/java/java (hỗ trợ tới Java 17).

Chỉnh sửa so với bản gốc (duy nhất): trong `JavaParser.g4` đổi `this.` -> `self.` (2 chỗ, semantic predicate)
để dùng target Python3. Lớp `JavaParserBase` được port tay sang Python vì repo gốc đã bỏ target Python3.
