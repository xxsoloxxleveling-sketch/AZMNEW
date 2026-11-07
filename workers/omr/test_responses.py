import unittest
from responses import classify
T={'blank':.2,'filled':.6}
class ResponseTests(unittest.TestCase):
    def test_blank(self):
        self.assertEqual(classify([0,.1,.2,0],T)['answer'],'BLANK')
    def test_all_options(self):
        for index,option in enumerate('ABCD'):
            values=[0,0,0,0]; values[index]=.9
            self.assertEqual(classify(values,T)['answer'],option)
    def test_multiple(self):
        result=classify([.9,0,.8,0],T)
        self.assertEqual(result['answer'],'MULTIPLE'); self.assertTrue(result['reviewRequired'])
    def test_weak_mark_requires_review_even_beside_strong(self):
        self.assertEqual(classify([.9,.3,0,0],T)['answer'],'UNCERTAIN')
    def test_missing_nonfinite_and_out_of_range_measurements_rejected(self):
        for values in [[],[0,0,0],[0,0,0,float('nan')],[0,0,0,float('inf')],[-1,0,0,0],[0,2,0,0]]:
            with self.assertRaises(ValueError): classify(values,T)
    def test_invalid_thresholds_rejected(self):
        for t in [{'blank':.8,'filled':.2},{'blank':.2,'filled':.2},{'blank':-.1,'filled':.6}]:
            with self.assertRaises(ValueError): classify([0,0,0,0],t)
if __name__=='__main__': unittest.main()
