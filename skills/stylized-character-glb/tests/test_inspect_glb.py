"""Run with: python3 -m unittest discover -s tests -v"""
import json
import struct
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from inspect_glb import inspect

def sample(doc,bad_length=False):
    body=json.dumps(doc).encode("utf-8")
    body+=b" "*((-len(body))%4)
    chunk=struct.pack("<II",len(body),0x4E4F534A)+body
    return struct.pack("<4sII",b"glTF",2,12+len(chunk)+int(bad_length))+chunk

class InspectTests(unittest.TestCase):
    def test_triangle(self):
        doc={"asset":{"version":"2.0"},"accessors":[{"count":3}],
             "meshes":[{"primitives":[{"attributes":{"POSITION":0}}]}]}
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/"a.glb";path.write_bytes(sample(doc))
            r=inspect(path)
            self.assertEqual(r["triangles_estimate"],1)
            self.assertEqual(r["vertices_estimate"],3)
    def test_bad_length(self):
        doc={"asset":{"version":"2.0"},"meshes":[{"primitives":[]}]}
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/"b.glb";path.write_bytes(sample(doc,True))
            with self.assertRaises(ValueError): inspect(path)
    def test_missing_meshes(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/"c.glb";path.write_bytes(sample({"asset":{"version":"2.0"}}))
            with self.assertRaises(ValueError): inspect(path)

if __name__=="__main__": unittest.main()
