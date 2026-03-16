#!/usr/bin/env python3
"""
Vitest Adapter for SystemEval
Converts Vitest JSON output to SystemEval format for MCP agent consumption
"""

import json
import sys
import subprocess
from datetime import datetime
from typing import Dict, List, Any
import uuid
import os


class VitestSystemEvalAdapter:
    """Adapter to convert Vitest results to SystemEval format"""
    
    def __init__(self, output_format: str = "json"):
        """
        Initialize the adapter
        
        Args:
            output_format: Vitest output format (json, verbose, etc.)
        """
        self.output_format = output_format
        self.results = {
            "execution": {
                "uuid": str(uuid.uuid4()),
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "branch": self._get_git_branch(),
                "commit": self._get_git_commit(),
                "environment": os.getenv("NODE_ENV", "development")
            },
            "summary": {
                "total": 0,
                "passed": 0,
                "failed": 0,
                "skipped": 0,
                "duration": 0
            },
            "test_files": [],
            "verdict": "UNKNOWN"
        }
    
    def _get_git_branch(self) -> str:
        """Get current git branch"""
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.stdout.strip() if result.returncode == 0 else "unknown"
        except Exception:
            return "unknown"
    
    def _get_git_commit(self) -> str:
        """Get current git commit hash"""
        try:
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.stdout.strip() if result.returncode == 0 else "unknown"
        except Exception:
            return "unknown"
    
    def parse_vitest_json(self, json_file: str) -> None:
        """
        Parse Vitest JSON output file
        
        Args:
            json_file: Path to Vitest JSON output file
        """
        with open(json_file, 'r') as f:
            vitest_data = json.load(f)
        
        # Parse test results
        self._parse_vitest_results(vitest_data)
        self._calculate_verdict()
    
    def _parse_vitest_results(self, vitest_data: Dict[str, Any]) -> None:
        """Parse Vitest results and populate adapter results"""
        
        # Vitest JSON structure
        test_files = vitest_data.get("testResults", [])
        
        total = 0
        passed = 0
        failed = 0
        skipped = 0
        total_duration = 0
        
        for test_file in test_files:
            file_result = {
                "name": test_file.get("name", ""),
                "duration": test_file.get("duration", 0),
                "tests": []
            }
            
            tests = test_file.get("assertionResults", [])
            
            for test in tests:
                test_info = {
                    "name": test.get("title", ""),
                    "status": test.get("status", "unknown"),
                    "duration": test.get("duration", 0)
                }
                
                total += 1
                total_duration += test.get("duration", 0)
                file_result["duration"] += test.get("duration", 0)
                
                if test.get("status") == "passed":
                    passed += 1
                    test_info["verdict"] = "PASS"
                elif test.get("status") == "failed":
                    failed += 1
                    test_info["verdict"] = "FAIL"
                    test_info["error"] = self._extract_error(test)
                elif test.get("status") == "skipped" or test.get("status") == "pending":
                    skipped += 1
                    test_info["verdict"] = "SKIP"
                else:
                    test_info["verdict"] = "ERROR"
                
                file_result["tests"].append(test_info)
            
            self.results["test_files"].append(file_result)
        
        # Update summary
        self.results["summary"] = {
            "total": total,
            "passed": passed,
            "failed": failed,
            "skipped": skipped,
            "duration": total_duration
        }
    
    def _extract_error(self, test: Dict[str, Any]) -> Dict[str, Any]:
        """Extract error information from failed test"""
        error_messages = test.get("error", {})
        
        error_info = {
            "message": error_messages.get("message", ""),
            "stack": error_messages.get("stack", ""),
            "expected": "",
            "actual": ""
        }
        
        # Extract assertion errors if available
        if "diff" in error_messages:
            error_info["diff"] = error_messages["diff"]
        
        return error_info
    
    def _calculate_verdict(self) -> None:
        """Calculate overall verdict based on test results"""
        summary = self.results["summary"]
        
        if summary["failed"] > 0:
            self.results["verdict"] = "FAIL"
        elif summary["total"] == 0:
            self.results["verdict"] = "ERROR"
        elif summary["skipped"] > 0 and summary["passed"] == 0:
            self.results["verdict"] = "SKIP"
        else:
            self.results["verdict"] = "PASS"
    
    def to_json(self, indent: int = 2) -> str:
        """Convert results to JSON string"""
        return json.dumps(self.results, indent=indent)
    
    def save_json(self, output_file: str) -> None:
        """Save results to JSON file"""
        with open(output_file, 'w') as f:
            json.dump(self.results, f, indent=2)
    
    def print_summary(self) -> None:
        """Print summary to stdout"""
        summary = self.results["summary"]
        
        print("\n" + "="*60)
        print("SYSTESEVAL SUMMARY")
        print("="*60)
        print(f"Verdict: {self.results['verdict']}")
        print(f"Total:   {summary['total']}")
        print(f"Passed:  {summary['passed']}")
        print(f"Failed:  {summary['failed']}")
        print(f"Skipped: {summary['skipped']}")
        print(f"Duration: {summary['duration']}ms")
        print("="*60 + "\n")


def main():
    """Main entry point"""
    if len(sys.argv) < 3:
        print("Usage: python vitest-adapter.py <vitest-json-file> <output-file> [--print-summary]")
        sys.exit(1)
    
    json_file = sys.argv[1]
    output_file = sys.argv[2]
    print_summary = "--print-summary" in sys.argv
    
    if not os.path.exists(json_file):
        print(f"Error: Vitest JSON file not found: {json_file}")
        sys.exit(1)
    
    # Create adapter and parse results
    adapter = VitestSystemEvalAdapter()
    adapter.parse_vitest_json(json_file)
    
    # Save to file
    adapter.save_json(output_file)
    print(f"SystemEval results saved to: {output_file}")
    
    # Print summary if requested
    if print_summary:
        adapter.print_summary()


if __name__ == "__main__":
    main()