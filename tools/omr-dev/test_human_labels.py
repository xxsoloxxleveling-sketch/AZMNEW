import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('human_labels',Path(__file__).with_name('label-physical.py'))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class HumanLabelTests(unittest.TestCase):
    def test_all_responses_and_human_confirmation_required(self):
        value={'sample':'S01','reviewer':'Fabricated reviewer','confirmed':True,'answers':['A']*100,'paperVersion':'C','layout':'FRAMED_100'}
        self.assertEqual(module.validate_label(value,'S01')['answers'],['A']*100)
        for change in ({'confirmed':False},{'answers':['A']*99},{'answers':['A']*99+['']},{'reviewer':''},{'paperVersion':''},{'sample':'S02'}):
            with self.assertRaises(ValueError):module.validate_label({**value,**change},'S01')

    def test_blank_multiple_and_uncertain_labels_are_preserved(self):
        answers=['BLANK','MULTIPLE','UNCERTAIN']+['D']*97
        value={'sample':'S01','reviewer':'Fabricated reviewer','confirmed':True,'answers':answers,'paperVersion':'UNCERTAIN','layout':'UNCERTAIN','scannerPrediction':['A']*100}
        clean=module.validate_label(value,'S01')
        self.assertEqual(clean['answers'],answers)
        self.assertNotIn('scannerPrediction',clean)


if __name__=='__main__':unittest.main()
