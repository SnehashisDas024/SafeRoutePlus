import os
import re

base_dir = r'C:\Users\sneha\Desktop\SafeRoutePlus'

# 1. Fix schema.py
schema_path = os.path.join(base_dir, 'backend', 'app', 'models', 'schema.py')
with open(schema_path, 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('impl = LargeBinary', 'impl = String')
content = content.replace('from sqlalchemy.types import TypeDecorator, LargeBinary', 'from sqlalchemy.types import TypeDecorator, String')
bind_target = '''    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, WKBElement):
            return bytes(value.data)
        if hasattr(value, 'wkb'):
            return value.wkb
        if isinstance(value, bytes):
            return value
        if isinstance(value, str):
            from shapely import wkt
            wkt_part = value.split(";", 1)[1] if ";" in value else value
            shape_obj = wkt.loads(wkt_part)
            return shape_obj.wkb
        if hasattr(value, 'data'):
            if isinstance(value.data, (bytes, memoryview)):
                return bytes(value.data)
            from shapely import wkt
            wkt_part = str(value.data).split(";", 1)[1] if ";" in str(value.data) else str(value.data)
            return wkt.loads(wkt_part).wkb
        return bytes(value)'''
bind_replacement = '''    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, WKBElement):
            return value.data.hex() if hasattr(value.data, 'hex') else value.data
        if hasattr(value, 'wkb'):
            return value.wkb.hex()
        if isinstance(value, bytes):
            return value.hex()
        return value'''
content = content.replace(bind_target, bind_replacement)
res_target = '''    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return WKBElement(bytes(value), srid=self.srid)'''
res_replacement = '''    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, str):
            return WKBElement(bytes.fromhex(value), srid=self.srid)
        return WKBElement(bytes(value), srid=self.srid)'''
content = content.replace(res_target, res_replacement)
with open(schema_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('schema.py fixed')

