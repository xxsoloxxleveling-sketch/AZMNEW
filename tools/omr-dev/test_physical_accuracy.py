import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('accuracy',Path(__file__).with_name('physical-accuracy.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)


class AccuracyTests(unittest.TestCase):
    def fixture(self):
        return {'responses':[{'question':i,'answer':'A','reviewRequired':False} for i in range(1,101)],'paperVersion':{'answer':'B'}},{'sample':'S19','reviewer':'Independent synthetic reviewer','confirmed':True,'answers':['A']*100,'paperVersion':'B','layout':'FRAMED_100','sourceSha256':'abc','source':'INDEPENDENT_HUMAN_TRANSCRIPTION','scannerPredictionsShown':False,'answerKeysShown':False,'reviewerUnexposed':True}

    def test_counts_wrong_acceptance_and_review_without_guessing(self):
        result,label=self.fixture();result['responses'][0]['answer']='B';result['responses'][1].update(answer='UNCERTAIN',reviewRequired=True)
        metrics=module.evaluate(result,label,'abc')
        self.assertEqual(metrics['falseAccepted'],1);self.assertEqual(metrics['acceptedJudged'],99);self.assertEqual(metrics['correct'],98);self.assertEqual(metrics['reviewRequired'],1)

    def test_unblinded_missing_exposure_and_source_mismatch_rejected(self):
        result,label=self.fixture()
        for change in [{'scannerPredictionsShown':True},{'answerKeysShown':True},{'reviewerUnexposed':False},{'reviewerUnexposed':None},{'sourceSha256':'wrong'},{'confirmed':False}]:
            with self.assertRaises(ValueError):module.evaluate(result,{**label,**change},'abc')

    def test_human_uncertainty_is_not_a_correct_or_incorrect_label(self):
        result,label=self.fixture();label['answers'][0]='UNCERTAIN';label['paperVersion']='UNCERTAIN'
        metrics=module.evaluate(result,label,'abc');self.assertEqual(metrics['judged'],99);self.assertIsNone(metrics['paperVersionCorrect'])
