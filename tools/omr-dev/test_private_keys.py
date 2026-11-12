import unittest
from prepare_private_keys import parse_page


class PrivateKeyTests(unittest.TestCase):
    def test_exact_group_version_and_question_order(self):
        for group in ('Class 7', 'Class 11 — Pre-Medical', 'BS Combined Groups'):
            text = f'{group} • Answer Key • Paper C\n' + '\n'.join(f'{number}\n{"ABCD"[(number-1)%4]}' for number in reversed(range(1, 101)))
            result = parse_page(text)
            self.assertEqual(result['group'], group)
            self.assertEqual(result['paperVersion'], 'C')
            self.assertEqual(result['answers'], list('ABCD' * 25))

    def test_missing_or_duplicate_question_rejected(self):
        heading = 'Class 8 • Answer Key • Paper B\n'
        for numbers in (range(1, 100), [*range(1, 100), 99]):
            with self.assertRaises(ValueError):
                parse_page(heading + '\n'.join(f'{number}\nA' for number in numbers))

    def test_missing_version_rejected(self):
        with self.assertRaises(ValueError):
            parse_page('Class 8 • Answer Key\n' + '\n'.join(f'{number}\nA' for number in range(1, 101)))


if __name__ == '__main__':
    unittest.main()
