"""No silent grade inflation: single ink dominates, real second marks stay flagged."""
import unittest
from bubble_evidence import verify_dominant_fill
T={'blank':.18166873157,'filled':.68176006227}
def decision(ring,center,inner,p20=None,std=None,span=None):
    return verify_dominant_fill(ring,center,inner,
        p20 if p20 is not None else [.04]*4,
        std if std is not None else [.20]*4,
        span if span is not None else [.50]*4,T)

class BubbleEvidenceTests(unittest.TestCase):
    def test_true_dominant_with_unprinted_white_paper_and_faint_outline_leakage(self):
        self.assertEqual(decision([.066,.106,.36,.869],[.499,.69,.182,.825],
            [.143,.257,.254,.838],p20=[.02,.03,.055,.9],std=[.2,.2,.215,.02],span=[.4,.5,.57,.1]),'D')
        self.assertEqual(decision([.846,.165,.249,.08],[.788,.371,.224,.301],
            [.803,.211,.169,.19],p20=[.8,.03,.057,.03],std=[.02,.2,.12,.2],span=[.1,.5,.31,.5]),'A')
        self.assertEqual(decision([.056,.076,.928,.209],[.438,.628,.885,.34],
            [.156,.212,.881,.243],p20=[.02,.03,.8,.055],std=[.2,.2,.01,.196],span=[.4,.5,.1,.525]),'C')

    def test_true_double_fills_remain_unresolved(self):
        self.assertIsNone(decision([.056,.889,.071,.857],[.402,.784,.265,.834],[.149,.815,.172,.823]))
        self.assertIsNone(decision([.91,.89,.05,.08],[.93,.89,.2,.2],[.89,.88,.1,.1]))

    def test_faint_second_pencil_fill_stays_unresolved(self):
        ring=[.99,.35,.0,.0];center=[.99,.35,.14,.18];inner=[.99,.35,.0,.0]
        self.assertIsNone(decision(ring,center,inner,p20=[.95,.35,.0,.0],
            std=[.01,.0,.2,.2],span=[.02,0,.4,.4]))
        self.assertIsNone(decision([.99,.27,.0,.0],[.99,.27,.14,.18],[.99,.27,.0,.0],
            p20=[.95,.27,0,0],std=[.01,.02,.2,.2],span=[.02,.05,.4,.4]))
        self.assertIsNone(decision([.92,.34,.09,.08],[.94,.40,.2,.2],[.91,.35,.1,.1],
            p20=[.8,.20,0,0],std=[.02,.16,.2,.2],span=[.1,.43,.4,.4]))
        self.assertIsNone(decision([.92,.35,.09,.08],[.94,.60,.2,.2],[.91,.35,.1,.1],
            p20=[.8,.10,0,0],std=[.02,.08,.2,.2],span=[.1,.24,.4,.4]))
        self.assertIsNone(decision([.91,.30,.08,.05],[.92,.60,.2,.2],[.90,.44,.1,.1]))

    def test_no_leader_no_paper_or_incomplete_evidence(self):
        self.assertIsNone(decision([.25,.09,.06,.08],[.40,.2,.2,.2],[.28,.15,.1,.1]))
        self.assertIsNone(decision([.90,.30,.09,.08],[.91,.2,.2,.2],[.88,.26,.1,.1],
            p20=[.8,.16,.02,.02]))
        self.assertIsNone(verify_dominant_fill([.9,float('nan'),.1,.1],[.9,.1,.1,.1],
            [.9,.1,.1,.1],[0]*4,[.2]*4,[.5]*4,T))
        self.assertIsNone(verify_dominant_fill([.9,.1,.1],[.9,.1,.1,.1],
            [.9,.1,.1,.1],[0]*4,[.2]*4,[.5]*4,T))
        self.assertIsNone(verify_dominant_fill([.9,.1,.1,.1],[.9,.1,.1,.1],
            [.9,.1,.1,.1],[0]*4,[.2]*4,[.5]*4,{'blank':0,'filled':.7}))

if __name__=='__main__':unittest.main()
